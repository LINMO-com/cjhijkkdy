/**
 * 统一响应工具
 * ----------------------------------------------------------------------------
 * 所有接口均通过此模块返回，保证响应格式一致：
 * { code: number, message: string, data: T | null }
 */
import type { Response } from 'express';
import type { ApiResponse } from '../types/index.js';

/** 业务码约定：0 成功，非 0 失败 */
export const BizCode = {
  SUCCESS: 0,
  FAIL: 1, // 通用失败
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
} as const;

/**
 * 成功响应
 * @param res Express 响应对象
 * @param data 业务数据
 * @param message 提示信息
 * @param httpStatus HTTP 状态码，默认 200
 */
export function success<T>(
  res: Response,
  data: T = null as unknown as T,
  message = '操作成功',
  httpStatus = 200,
): Response {
  const body: ApiResponse<T> = { code: BizCode.SUCCESS, message, data };
  return res.status(httpStatus).json(body);
}

/**
 * 失败响应
 * @param res Express 响应对象
 * @param message 错误提示
 * @param code 业务码
 * @param httpStatus HTTP 状态码
 */
export function fail(
  res: Response,
  message: string,
  code: number = BizCode.FAIL,
  httpStatus: number = 400,
): Response {
  const body: ApiResponse = { code, message, data: null };
  return res.status(httpStatus).json(body);
}
