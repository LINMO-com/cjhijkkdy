/**
 * Axios 实例与 API 封装
 * ----------------------------------------------------------------------------
 * 统一处理请求/响应拦截、错误提示、token 注入
 */
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type {
  ApiResponse,
  FileDTO,
  FileListDTO,
  FileQueryParams,
  LoginResult,
  PreviewResult,
  ShareTokenResult,
} from '@/types';

/** 创建 axios 实例 */
const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// ----------------------------------------------------------------------------
// 请求拦截器：自动注入 JWT 令牌
// ----------------------------------------------------------------------------
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ----------------------------------------------------------------------------
// 响应拦截器：统一解包 ApiResponse，处理错误
// ----------------------------------------------------------------------------
http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse;
    // 业务成功：保留完整 response，业务层通过 res.data.data 取值
    if (body.code === 0) {
      return response;
    }
    // 业务失败：抛错
    return Promise.reject(new Error(body.message || '请求失败'));
  },
  (error) => {
    // HTTP 错误
    if (error.response) {
      const body = error.response.data as ApiResponse | undefined;
      const message = body?.message || `请求错误 (${error.response.status})`;
      // 401 未授权：清除 token 并跳转登录
      if (error.response.status === 401) {
        localStorage.removeItem('admin_token');
        if (window.location.pathname.startsWith('/admin')) {
          window.location.href = '/admin/login';
        }
      }
      return Promise.reject(new Error(message));
    }
    return Promise.reject(new Error(error.message || '网络异常'));
  },
);

// ============================================================================
// API 模块
// ============================================================================

/** 认证 API */
export const authApi = {
  /** 管理员登录 */
  async login(username: string, password: string): Promise<LoginResult> {
    const res = await http.post<ApiResponse<LoginResult>>('/auth/login', { username, password });
    return res.data.data!;
  },
};

/** 公开文件 API */
export const fileApi = {
  /** 公开文件列表 */
  async list(params: FileQueryParams = {}): Promise<FileListDTO> {
    const res = await http.get<ApiResponse<FileListDTO>>('/files', { params });
    return res.data.data!;
  },

  /** 文件详情 */
  async getById(id: string): Promise<FileDTO> {
    const res = await http.get<ApiResponse<FileDTO>>(`/files/${id}`);
    return res.data.data!;
  },

  /** 在线预览（纯文本/Markdown/JSON） */
  async preview(id: string): Promise<PreviewResult> {
    const res = await http.get<ApiResponse<PreviewResult>>(`/files/${id}/preview`);
    return res.data.data!;
  },

  /** 图片预览 URL（直接作为 img src） */
  previewImageUrl(id: string): string {
    return `/api/files/${id}/preview`;
  },
};

/** 管理后台文件 API */
export const adminFileApi = {
  /** 管理端文件列表（含私有） */
  async list(params: FileQueryParams = {}): Promise<FileListDTO> {
    const res = await http.get<ApiResponse<FileListDTO>>('/admin/files', { params });
    return res.data.data!;
  },

  /** 管理端文件详情（含私有） */
  async getById(id: string): Promise<FileDTO> {
    const res = await http.get<ApiResponse<FileDTO>>(`/admin/files/${id}`);
    return res.data.data!;
  },

  /** 上传文件（FormData） */
  async upload(files: File[], meta?: { title?: string; description?: string; category?: string; tags?: string[] }): Promise<FileDTO[]> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    if (meta?.title) form.append('title', meta.title);
    if (meta?.description) form.append('description', meta.description);
    if (meta?.category) form.append('category', meta.category);
    if (meta?.tags) form.append('tags', JSON.stringify(meta.tags));
    const res = await http.post<ApiResponse<FileDTO[]>>('/admin/files', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data!;
  },

  /** 编辑元数据 */
  async update(id: string, input: Partial<Pick<FileDTO, 'title' | 'description' | 'category' | 'tags' | 'isPublic'>>): Promise<FileDTO> {
    const res = await http.put<ApiResponse<FileDTO>>(`/admin/files/${id}`, input);
    return res.data.data!;
  },

  /** 重命名 */
  async rename(id: string, newName: string): Promise<FileDTO> {
    const res = await http.post<ApiResponse<FileDTO>>(`/admin/files/${id}/rename`, { newName });
    return res.data.data!;
  },

  /** 删除 */
  async delete(id: string): Promise<void> {
    await http.delete(`/admin/files/${id}`);
  },

  /** 生成分享链接 */
  async generateShare(id: string): Promise<ShareTokenResult> {
    const res = await http.post<ApiResponse<ShareTokenResult>>(`/admin/files/${id}/share`);
    return res.data.data!;
  },
};

/** 分享下载 API（直接跳转，无需封装） */
export const shareApi = {
  /** 获取下载 URL */
  downloadUrl(shareToken: string): string {
    return `/api/share/${shareToken}/download`;
  },
};
