/**
 * 统一错误处理中间件
 * ----------------------------------------------------------------------------
 * 捕获所有未处理错误，统一返回 JSON 格式。
 * 区分业务错误（已知）与系统错误（未知），避免泄露堆栈。
 */
import type { NextFunction, Request, Response } from 'express';
import { fail, BizCode } from '../utils/response.js';
import { ShareTokenError } from '../services/ShareTokenService.js';

/**
 * 自定义业务错误（携带 HTTP 状态码）
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: number = BizCode.FAIL,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * 404 处理：未匹配到任何路由
 */
export function notFoundHandler(req: Request, res: Response): void {
  fail(res, `接口不存在: ${req.method} ${req.path}`, BizCode.NOT_FOUND, 404);
}

/**
 * 全局错误处理（必须注册在所有路由之后，4 参数签名）
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // 分享令牌错误 → 403 Forbidden
  if (err instanceof ShareTokenError) {
    fail(res, err.message, BizCode.FORBIDDEN, 403);
    return;
  }
  // 自定义 HTTP 错误
  if (err instanceof HttpError) {
    fail(res, err.message, err.code, err.statusCode);
    return;
  }
  // Multer 上传错误（如文件过大）
  if (err.name === 'MulterError') {
    const message = err.message === 'File too large' ? '上传文件超过大小限制' : `上传错误: ${err.message}`;
    fail(res, message, BizCode.VALIDATION_ERROR, 400);
    return;
  }
  // 其他未知错误：生产环境隐藏详情
  console.error('[未处理错误]', err);
  const message = process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message;
  fail(res, message, BizCode.FAIL, 500);
}
