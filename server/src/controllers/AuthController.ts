/**
 * 认证控制器 AuthController
 * ----------------------------------------------------------------------------
 * 处理管理员登录接口
 */
import type { Response } from 'express';
import { authService } from '../services/AuthService.js';
import { success, fail, BizCode } from '../utils/response.js';
import type { AuthedRequest } from '../types/index.js';

export class AuthController {
  /**
   * POST /api/auth/login
   * 管理员登录
   */
  async login(req: AuthedRequest, res: Response): Promise<void> {
    const { username, password } = req.body || {};
    if (!username || !password) {
      fail(res, '用户名和密码不能为空', BizCode.VALIDATION_ERROR, 422);
      return;
    }
    try {
      const result = await authService.login(username, password);
      success(res, result, '登录成功');
    } catch (err) {
      fail(res, (err as Error).message, BizCode.UNAUTHORIZED, 401);
    }
  }
}

export const authController = new AuthController();
