/**
 * 安全中间件集合
 * ----------------------------------------------------------------------------
 * 1. 请求体大小限制
 * 2. 基础安全响应头（Helmet 精简版）
 * 3. 请求日志（简易版）
 */
import type { Request, Response, NextFunction } from 'express';

/**
 * 设置基础安全响应头
 * 不引入 helmet 依赖，手动设置关键头，减少依赖体积
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff'); // 禁止 MIME 嗅探
  res.setHeader('X-Frame-Options', 'DENY'); // 禁止被 iframe 嵌套（防点击劫持）
  res.setHeader('X-XSS-Protection', '1; mode=block'); // XSS 过滤
  res.setHeader('Referrer-Policy', 'no-referrer'); // 不泄露 Referrer
  res.setHeader('Cache-Control', 'no-store'); // API 响应不缓存
  next();
}

/**
 * 简易请求日志中间件
 */
export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    console.info(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${_res.statusCode} ${duration}ms`);
  });
  next();
}
