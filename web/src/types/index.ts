/**
 * 前端类型定义
 * ----------------------------------------------------------------------------
 * 与后端 API 响应结构对齐
 */

/** 统一 API 响应结构 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

/** 文件传输对象 */
export interface FileDTO {
  id: string;
  originalName: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[] | null;
  mimeType: string;
  size: number;
  ext: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 文件列表响应 */
export interface FileListDTO {
  list: FileDTO[];
  total: number;
  page: number;
  pageSize: number;
}

/** 分享链接生成结果 */
export interface ShareTokenResult {
  shareToken: string;
  downloadUrl: string;
  expireAt: number;
  sizeTier: 'normal' | 'large';
}

/** 登录结果 */
export interface LoginResult {
  token: string;
  admin: { id: string; username: string };
}

/** 预览内容响应 */
export interface PreviewResult {
  type: 'text';
  ext: string;
  content: string;
}

/** 文件列表查询参数 */
export interface FileQueryParams {
  ext?: string;
  category?: string;
  tag?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}
