/**
 * 路由注册模块
 * ----------------------------------------------------------------------------
 * 集中注册所有 API 路由，按业务域分组：
 * - /api/auth        认证
 * - /api/files       公开文件浏览
 * - /api/admin/files 管理后台文件操作（需鉴权）
 * - /api/share       安全下载
 */
import { Router } from 'express';
import { authController } from '../controllers/AuthController.js';
import { fileController } from '../controllers/FileController.js';
import { adminFileController } from '../controllers/AdminFileController.js';
import { shareController } from '../controllers/ShareController.js';
import { authMiddleware } from '../middlewares/auth.js';
import { uploadSingle, uploadArray } from '../middlewares/upload.js';

export const router = Router();

// ----------------------------------------------------------------------------
// 认证路由
// ----------------------------------------------------------------------------
router.post('/api/auth/login', (req, res) => authController.login(req, res));

// ----------------------------------------------------------------------------
// 公开文件路由（无需鉴权，仅返回公开文件）
// ----------------------------------------------------------------------------
router.get('/api/files', (req, res) => fileController.list(req, res));
router.get('/api/files/:id', (req, res) => fileController.getById(req, res));
router.get('/api/files/:id/preview', (req, res) => fileController.preview(req, res));

// ----------------------------------------------------------------------------
// 管理后台文件路由（需鉴权）
// ----------------------------------------------------------------------------
router.post('/api/admin/files', authMiddleware, uploadArray, (req, res, next) =>
  adminFileController.upload(req, res).catch(next),
);
router.get('/api/admin/files', authMiddleware, (req, res, next) =>
  adminFileController.list(req, res).catch(next),
);
router.get('/api/admin/files/:id', authMiddleware, (req, res, next) =>
  adminFileController.getById(req, res).catch(next),
);
router.put('/api/admin/files/:id', authMiddleware, (req, res, next) =>
  adminFileController.update(req, res).catch(next),
);
router.post('/api/admin/files/:id/rename', authMiddleware, (req, res, next) =>
  adminFileController.rename(req, res).catch(next),
);
router.delete('/api/admin/files/:id', authMiddleware, (req, res, next) =>
  adminFileController.delete(req, res).catch(next),
);
router.post('/api/admin/files/:id/share', authMiddleware, (req, res, next) =>
  adminFileController.generateShare(req, res).catch(next),
);

// ----------------------------------------------------------------------------
// 安全下载路由（无需登录鉴权，但需分享令牌校验）
// ----------------------------------------------------------------------------
router.get('/api/share/:token/download', (req, res, next) =>
  shareController.download(req, res).catch(next),
);

// 导出 uploadSingle 供单文件上传场景使用
export { uploadSingle };
