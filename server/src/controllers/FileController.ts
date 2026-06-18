/**
 * 公开文件控制器 FileController
 * ----------------------------------------------------------------------------
 * 处理公开网页前端的文件浏览与预览接口
 * 仅返回 is_public=true 的文件
 */
import type { Response } from 'express';
import { fileService } from '../services/FileService.js';
import { success, fail, BizCode } from '../utils/response.js';
import { isTextLike, isImage } from '../utils/fileType.js';
import type { AuthedRequest, FileQuery } from '../types/index.js';

export class FileController {
  /**
   * GET /api/files
   * 公开文件列表（仅 is_public=true）
   */
  async list(req: AuthedRequest, res: Response): Promise<void> {
    const query: FileQuery = {
      ext: typeof req.query.ext === 'string' ? req.query.ext : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      tag: typeof req.query.tag === 'string' ? req.query.tag : undefined,
      keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20,
      publicOnly: true, // 公开接口强制只查公开文件
    };
    const result = await fileService.list(query);
    success(res, result);
  }

  /**
   * GET /api/files/:id
   * 文件详情（仅公开）
   */
  async getById(req: AuthedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const file = await fileService.getById(id, true);
      success(res, file);
    } catch (err) {
      fail(res, (err as Error).message, BizCode.NOT_FOUND, 404);
    }
  }

  /**
   * GET /api/files/:id/preview
   * 在线预览（纯文本/图片）
   * - 纯文本类：返回 JSON 包装的文本内容
   * - 图片类：直接返回二进制流，Content-Type 为图片类型
   */
  async preview(req: AuthedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      // 先取文件元数据判断类型
      const file = await fileService.getById(id, true);
      if (isTextLike(file.ext)) {
        // 纯文本：读取内容并返回（限制 2MB）
        const { buffer } = await fileService.getPreviewContent(id, 2 * 1024 * 1024);
        success(res, {
          type: 'text',
          ext: file.ext,
          content: buffer.toString('utf8'),
        });
        return;
      }
      if (isImage(file.ext)) {
        // 图片：直接返回二进制流
        const { buffer, mimeType } = await fileService.getPreviewContent(id, 10 * 1024 * 1024);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).end(buffer);
        return;
      }
      fail(res, '该文件格式不支持在线预览', BizCode.FAIL, 400);
    } catch (err) {
      fail(res, (err as Error).message, BizCode.NOT_FOUND, 404);
    }
  }
}

export const fileController = new FileController();
