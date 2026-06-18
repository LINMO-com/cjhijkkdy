/**
 * 全局类型定义
 * ----------------------------------------------------------------------------
 * 集中定义跨模块共享的 TypeScript 类型，保证类型安全
 */
import type { Request } from 'express';

/** 文件大小等级：normal=普通文件, large=大文件 */
export type SizeTier = 'normal' | 'large';

/** 分享令牌 payload（签名前的明文结构） */
export interface SharePayload {
  /** 关联文件 ID */
  fileId: string;
  /** 过期时间戳（毫秒） */
  expireAt: number;
  /** 文件大小等级，决定有效期长短 */
  sizeTier: SizeTier;
  /** 随机串，防重放（无状态校验下主要用于增加熵） */
  nonce: string;
}

/** 分享链接生成结果 */
export interface ShareTokenResult {
  /** 完整分享令牌：base64url(payload).base64url(signature) */
  shareToken: string;
  /** 拼接好的下载 URL */
  downloadUrl: string;
  /** 过期时间戳（毫秒） */
  expireAt: number;
  /** 文件大小等级 */
  sizeTier: SizeTier;
}

/** 统一 API 响应结构 */
export interface ApiResponse<T = unknown> {
  /** 业务码：0 成功，非 0 失败 */
  code: number;
  /** 提示信息 */
  message: string;
  /** 业务数据 */
  data: T | null;
}

/** 扩展 Express.Request，附带鉴权后的管理员信息 */
export interface AuthedRequest extends Request {
  admin?: {
    id: string;
    username: string;
  };
}

/** 文件列表查询参数 */
export interface FileQuery {
  ext?: string;
  category?: string;
  tag?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  /** 是否仅查公开文件（公开接口强制为 true） */
  publicOnly?: boolean;
}

/** 文件元数据更新参数 */
export interface FileUpdateInput {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
}
