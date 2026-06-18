/**
 * 分享下载控制器 ShareController
 * ----------------------------------------------------------------------------
 * 处理公开的安全下载接口
 * 校验分享令牌 → 流式返回文件内容
 * 过期/签名错误 → 403 Forbidden
 */
import type { Response } from 'express';
import { fileService } from '../services/FileService.js';
import { fail, BizCode } from '../utils/response.js';
import { ShareTokenError } from '../services/ShareTokenService.js';
import type { AuthedRequest } from '../types/index.js';

export class ShareController {
  /**
   * GET /api/share/:token/download
   * 安全下载
   * 1. 校验分享令牌（签名 + 过期）
   * 2. 流式返回文件
   * 3. 设置 Content-Disposition 触发浏览器下载
   */
  async download(req: AuthedRequest, res: Response): Promise<void> {
    const { token } = req.params;
    try {
      const { stream, filename, mimeType, size } = await fileService.downloadByShareToken(token);

      // 设置响应头
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', String(size));
      // attachment 触发下载，filename* 支持 UTF-8 文件名
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      );
      res.setHeader('Cache-Control', 'no-store');

      // 流式传输，避免大文件内存溢出
      stream.pipe(res);
      stream.on('error', () => {
        if (!res.headersSent) {
          fail(res, '文件读取失败', BizCode.FAIL, 500);
        }
      });
    } catch (err) {
      // 分享令牌错误统一返回 403
      if (err instanceof ShareTokenError) {
        fail(res, err.message, BizCode.FORBIDDEN, 403);
        return;
      }
      fail(res, (err as Error).message, BizCode.FAIL, 500);
    }
  }
}

export const shareController = new ShareController();
