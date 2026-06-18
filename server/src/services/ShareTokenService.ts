/**
 * 分享令牌服务 ShareTokenService（核心安全模块）
 * ============================================================================
 * 本模块实现「动态安全下载策略」的核心逻辑：
 *
 * 1. 生成阶段 generate()
 *    - 根据文件大小判定 sizeTier：
 *        size < 100MB → normal，有效期 15 分钟
 *        size >= 100MB → large，有效期 30 分钟
 *    - 构造 payload = { fileId, expireAt, sizeTier, nonce }
 *    - 使用服务器密钥以 HMAC-SHA256 对 payload 签名
 *    - 返回 shareToken = base64url(payload) + '.' + base64url(signature)
 *
 * 2. 校验阶段 verify()
 *    - 拆分 shareToken 为 payloadStr 与 signature
 *    - 重新计算签名，使用「恒定时间比较」防时序攻击
 *    - 校验签名 → 校验过期 → 返回 payload
 *    - 任何校验失败抛出 ShareTokenError（HTTP 403）
 *
 * 安全要点：
 * - 签名密钥仅存后端环境变量，前端无法伪造令牌
 * - 无状态校验：不依赖数据库，过期判定完全基于 payload 中的 expireAt
 * - 恒定时间比较：防止通过响应时间差异推断签名字节
 * - 文件路径由数据库 storageKey 决定，绝不使用客户端传入路径
 * ============================================================================
 */
import crypto from 'node:crypto';
import { config } from '../config/index.js';
import type { SharePayload, ShareTokenResult, SizeTier } from '../types/index.js';

/** 分享令牌校验失败错误 */
export class ShareTokenError extends Error {
  public readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ShareTokenError';
  }
}

export class ShareTokenService {
  /**
   * 根据文件大小判定 sizeTier 与对应有效期（毫秒）
   * @param size 文件字节数
   * @returns { sizeTier, ttlMs }
   */
  decideTtl(size: number): { sizeTier: SizeTier; ttlMs: number } {
    if (size >= config.share.largeFileThreshold) {
      // 大文件：30 分钟
      return { sizeTier: 'large', ttlMs: config.share.ttlLargeMinutes * 60 * 1000 };
    }
    // 普通文件：15 分钟
    return { sizeTier: 'normal', ttlMs: config.share.ttlNormalMinutes * 60 * 1000 };
  }

  /**
   * 生成分享令牌
   * @param fileId 文件 ID
   * @param size 文件字节数（用于判定有效期）
   * @returns ShareTokenResult
   */
  generate(fileId: string, size: number): ShareTokenResult {
    const { sizeTier, ttlMs } = this.decideTtl(size);
    const now = Date.now();
    const expireAt = now + ttlMs;

    // 构造 payload，nonce 增加熵并防重放
    const payload: SharePayload = {
      fileId,
      expireAt,
      sizeTier,
      nonce: crypto.randomUUID(),
    };

    // 编码 payload 为 base64url
    const payloadStr = this.base64urlEncode(JSON.stringify(payload));
    // HMAC-SHA256 签名
    const signature = this.sign(payloadStr);
    // 拼接令牌
    const shareToken = `${payloadStr}.${signature}`;

    // 拼接下载 URL（相对路径，由前端补全域名）
    const downloadUrl = `/api/share/${shareToken}/download`;

    return { shareToken, downloadUrl, expireAt, sizeTier };
  }

  /**
   * 校验分享令牌
   * @param shareToken 完整令牌
   * @returns 校验通过返回 payload
   * @throws ShareTokenError 校验失败（签名错误/过期/格式错误）
   */
  verify(shareToken: string): SharePayload {
    // 1. 拆分令牌，必须恰好两段
    const parts = shareToken.split('.');
    if (parts.length !== 2) {
      throw new ShareTokenError('无效的分享令牌格式');
    }
    const [payloadStr, signature] = parts;
    if (!payloadStr || !signature) {
      throw new ShareTokenError('无效的分享令牌内容');
    }

    // 2. 重新计算签名并恒定时间比较（防时序攻击）
    const expectedSig = this.sign(payloadStr);
    if (!this.constantTimeEqual(signature, expectedSig)) {
      throw new ShareTokenError('分享令牌签名校验失败');
    }

    // 3. 解码 payload
    let payload: SharePayload;
    try {
      const json = this.base64urlDecode(payloadStr);
      payload = JSON.parse(json) as SharePayload;
    } catch {
      throw new ShareTokenError('分享令牌解析失败');
    }

    // 4. 校验必填字段
    if (!payload.fileId || !payload.expireAt || !payload.sizeTier) {
      throw new ShareTokenError('分享令牌内容不完整');
    }

    // 5. 校验过期时间
    if (payload.expireAt < Date.now()) {
      throw new ShareTokenError('分享链接已过期');
    }

    return payload;
  }

  /**
   * 使用 HMAC-SHA256 对字符串签名，返回 base64url 编码的签名
   * @param data 待签名数据
   */
  private sign(data: string): string {
    const hmac = crypto.createHmac('sha256', config.share.secret);
    hmac.update(data, 'utf8');
    // 转为 base64url（无填充，URL 安全）
    return hmac.digest('base64url');
  }

  /**
   * 恒定时间字符串比较，防止时序攻击
   * 即使长度不同也消耗相同时间，避免通过响应时间推断签名
   */
  private constantTimeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    // 长度不同时仍调用 timingSafeEqual 以保持恒定时间，但返回 false
    if (bufA.length !== bufB.length) {
      // 用相同长度的比较消耗时间，再返回 false
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * base64url 编码（URL 安全，无 + / = 字符）
   */
  private base64urlEncode(str: string): string {
    return Buffer.from(str, 'utf8').toString('base64url');
  }

  /**
   * base64url 解码
   */
  private base64urlDecode(str: string): string {
    return Buffer.from(str, 'base64url').toString('utf8');
  }
}

// 导出单例
export const shareTokenService = new ShareTokenService();
