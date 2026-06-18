/**
 * JWT 鉴权中间件
 * ----------------------------------------------------------------------------
 * 校验请求头 Authorization: Bearer <token>，验证通过后将管理员信息挂到 req.admin
 */
import type { NextFunction, Response } from 'express';
import { authService } from '../services/AuthService.js';
import { fail, BizCode } from '../utils/response.js';
import type { AuthedRequest } from '../types/index.js';

/**
 * 管理员鉴权中间件
 * 从 Authorization 头提取 Bearer 令牌并校验
 */
export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    fail(res, '未提供认证令牌', BizCode.UNAUTHORIZED, 401);
    return;
  }
  const token = authHeader.slice(7).trim();
  try {
    const payload = authService.verifyToken(token);
    req.admin = { id: payload.id, username: payload.username };
    next();
  } catch {
    fail(res, '认证令牌无效或已过期', BizCode.UNAUTHORIZED, 401);
  }
}
