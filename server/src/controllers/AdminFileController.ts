/**
 * 管理后台文件控制器 AdminFileController
 * ----------------------------------------------------------------------------
 * 处理管理后台的文件上传、编辑、重命名、删除、生成分享链接等接口
 * 所有接口需经 authMiddleware 鉴权
 */
import type { Response } from 'express';
import { fileService } from '../services/FileService.js';
import { success, fail, BizCode } from '../utils/response.js';
import { HttpError } from '../middlewares/error.js';
import type { AuthedRequest, FileUpdateInput, FileQuery } from '../types/index.js';

export class AdminFileController {
  /**
   * POST /api/admin/files
   * 上传文件（支持单/多文件）
   */
  async upload(req: AuthedRequest, res: Response): Promise<void> {
    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    if (files.length === 0) {
      fail(res, '未上传任何文件', BizCode.VALIDATION_ERROR, 422);
      return;
    }
    const meta = {
      title: req.body.title as string | undefined,
      description: req.body.description as string | undefined,
      category: req.body.category as string | undefined,
      tags: req.body.tags ? JSON.parse(req.body.tags as string) : undefined,
    };
    try {
      const results = [];
      for (const f of files) {
        // 逐个文件上传并校验
        const dto = await fileService.upload(f.originalname, f.buffer, meta);
        results.push(dto);
      }
      success(res, results, `成功上传 ${results.length} 个文件`);
    } catch (err) {
      throw new HttpError(400, (err as Error).message, BizCode.VALIDATION_ERROR);
    }
  }

  /**
   * GET /api/admin/files
   * 管理端文件列表（含私有文件）
   */
  async list(req: AuthedRequest, res: Response): Promise<void> {
    const query: FileQuery = {
      ext: typeof req.query.ext === 'string' ? req.query.ext : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      tag: typeof req.query.tag === 'string' ? req.query.tag : undefined,
      keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20,
      publicOnly: false, // 管理端可见所有文件
    };
    const result = await fileService.list(query);
    success(res, result);
  }

  /**
   * GET /api/admin/files/:id
   * 管理端文件详情
   */
  async getById(req: AuthedRequest, res: Response): Promise<void> {
    try {
      const file = await fileService.getById(req.params.id, false);
      success(res, file);
    } catch (err) {
      throw new HttpError(404, (err as Error).message, BizCode.NOT_FOUND);
    }
  }

  /**
   * PUT /api/admin/files/:id
   * 编辑文件元数据
   */
  async update(req: AuthedRequest, res: Response): Promise<void> {
    const input: FileUpdateInput = req.body || {};
    try {
      const file = await fileService.update(req.params.id, input);
      success(res, file, '更新成功');
    } catch (err) {
      throw new HttpError(400, (err as Error).message, BizCode.FAIL);
    }
  }

  /**
   * POST /api/admin/files/:id/rename
   * 重命名文件（含同名冲突检测 + 底层存储同步）
   */
  async rename(req: AuthedRequest, res: Response): Promise<void> {
    const { newName } = req.body || {};
    if (!newName || typeof newName !== 'string') {
      fail(res, '新文件名不能为空', BizCode.VALIDATION_ERROR, 422);
      return;
    }
    try {
      const file = await fileService.rename(req.params.id, newName.trim());
      success(res, file, '重命名成功');
    } catch (err) {
      // 同名冲突返回 409
      const msg = (err as Error).message;
      const code = msg.includes('同名') ? BizCode.CONFLICT : BizCode.FAIL;
      throw new HttpError(msg.includes('同名') ? 409 : 400, msg, code);
    }
  }

  /**
   * DELETE /api/admin/files/:id
   * 删除文件（含底层存储文件）
   */
  async delete(req: AuthedRequest, res: Response): Promise<void> {
    try {
      await fileService.delete(req.params.id);
      success(res, null, '删除成功');
    } catch (err) {
      throw new HttpError(404, (err as Error).message, BizCode.NOT_FOUND);
    }
  }

  /**
   * POST /api/admin/files/:id/share
   * 生成分享链接（核心）
   * 根据文件大小自动判定有效期：普通文件 15 分钟，大文件 30 分钟
   */
  async generateShare(req: AuthedRequest, res: Response): Promise<void> {
    try {
      const result = await fileService.generateShareLink(req.params.id);
      success(res, result, '分享链接已生成');
    } catch (err) {
      throw new HttpError(404, (err as Error).message, BizCode.NOT_FOUND);
    }
  }
}

export const adminFileController = new AdminFileController();
