/**
 * 文件服务 FileService
 * ----------------------------------------------------------------------------
 * 文件业务逻辑核心，协调 Repository、StorageProvider、ShareTokenService。
 * 职责：上传、查询、编辑、重命名、删除、生成分享链接、安全下载。
 */
import { randomUUID } from 'node:crypto';
import type { Readable } from 'stream';
import { fileRepository } from '../repositories/FileRepository.js';
import { shareLogRepository } from '../repositories/ShareLogRepository.js';
import { localStorageProvider } from '../storage/LocalStorageProvider.js';
import { shareTokenService } from './ShareTokenService.js';
import { generateStorageKey } from '../utils/pathSecurity.js';
import { getMimeType, validateUploadedFile, getExt } from '../utils/fileType.js';
import type { FileQuery, FileUpdateInput, ShareTokenResult } from '../types/index.js';
import type { File } from '../models/File.js';

/** 文件列表查询结果（脱敏后） */
export interface FileListDTO {
  list: FileDTO[];
  total: number;
  page: number;
  pageSize: number;
}

/** 文件传输对象（脱敏，不含 storageKey） */
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
  createdAt: Date;
  updatedAt: Date;
}

/** 将模型实例转为 DTO（脱敏 storageKey，避免泄露存储路径） */
function toDTO(file: File): FileDTO {
  return {
    id: file.id,
    originalName: file.originalName,
    title: file.title,
    description: file.description,
    category: file.category,
    tags: file.tags,
    mimeType: file.mimeType,
    size: Number(file.size),
    ext: file.ext,
    isPublic: file.isPublic,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

export class FileService {
  /**
   * 上传文件
   * @param originalName 原始文件名
   * @param buffer 文件内容
   * @param meta 元数据（标题/描述/分类/标签）
   * @returns 创建后的文件 DTO
   */
  async upload(
    originalName: string,
    buffer: Buffer,
    meta: { title?: string; description?: string; category?: string; tags?: string[] },
  ): Promise<FileDTO> {
    // 1. 安全校验：扩展名白名单 + 魔数校验
    validateUploadedFile(originalName, buffer);

    const ext = getExt(originalName);
    // 2. 生成安全的存储键（与原始文件名解耦）
    const storageKey = generateStorageKey(ext);
    // 3. 保存到存储层
    const { size } = await localStorageProvider.save(storageKey, buffer);

    // 4. 写入数据库
    const file = await fileRepository.create({
      id: randomUUID(),
      originalName,
      storageKey,
      title: meta.title || originalName,
      description: meta.description || null,
      category: meta.category || 'uncategorized',
      tags: meta.tags || null,
      mimeType: getMimeType(ext),
      size,
      ext,
      isPublic: true,
    });

    return toDTO(file);
  }

  /**
   * 文件列表查询
   * @param query 查询参数
   */
  async list(query: FileQuery): Promise<FileListDTO> {
    const result = await fileRepository.findMany(query);
    return {
      list: result.list.map(toDTO),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  /**
   * 获取文件详情
   * @param id 文件 ID
   * @param publicOnly 是否仅查公开文件
   */
  async getById(id: string, publicOnly = false): Promise<FileDTO> {
    const file = await fileRepository.findById(id, publicOnly);
    if (!file) throw new Error('文件不存在');
    return toDTO(file);
  }

  /**
   * 编辑文件元数据
   */
  async update(id: string, input: FileUpdateInput): Promise<FileDTO> {
    const file = await fileRepository.findById(id);
    if (!file) throw new Error('文件不存在');
    await fileRepository.update(id, input);
    const updated = await fileRepository.findById(id);
    return toDTO(updated!);
  }

  /**
   * 重命名文件
   * - 同名冲突检测
   * - 同步更新底层存储（生成新 storageKey 并移动文件）
   * @param id 文件 ID
   * @param newName 新文件名
   */
  async rename(id: string, newName: string): Promise<FileDTO> {
    const file = await fileRepository.findById(id);
    if (!file) throw new Error('文件不存在');

    // 1. 同名冲突检测（排除自身）
    const exists = await fileRepository.existsByOriginalName(newName, id);
    if (exists) throw new Error(`已存在同名文件: ${newName}`);

    // 2. 生成新存储键（保持原扩展名）
    const ext = getExt(newName) || file.ext;
    const newStorageKey = generateStorageKey(ext);

    // 3. 移动底层文件
    await localStorageProvider.rename(file.storageKey, newStorageKey);

    // 4. 更新数据库（存储键 + 原始文件名）
    await fileRepository.updateStorageKey(id, newStorageKey, newName);

    const updated = await fileRepository.findById(id);
    return toDTO(updated!);
  }

  /**
   * 删除文件
   * - 删除底层存储文件
   * - 删除数据库记录（级联删除分享日志）
   */
  async delete(id: string): Promise<void> {
    const file = await fileRepository.findById(id);
    if (!file) throw new Error('文件不存在');
    // 先删文件，再删记录
    await localStorageProvider.delete(file.storageKey);
    await fileRepository.delete(id);
  }

  /**
   * 生成分享链接（核心）
   * @param id 文件 ID
   * @returns 分享令牌结果
   */
  async generateShareLink(id: string): Promise<ShareTokenResult> {
    const file = await fileRepository.findById(id);
    if (!file) throw new Error('文件不存在');

    // 调用 ShareTokenService 生成令牌（根据文件大小自动判定有效期）
    const result = shareTokenService.generate(file.id, Number(file.size));

    // 记录审计日志
    await shareLogRepository.create({
      id: randomUUID(),
      fileId: file.id,
      shareToken: result.shareToken,
      sizeTier: result.sizeTier,
      expireAt: new Date(result.expireAt),
    });

    return result;
  }

  /**
   * 安全下载（核心）
   * 校验分享令牌 → 返回文件流与元数据
   * @param shareToken 分享令牌
   * @returns 文件流、文件名、MIME、大小
   * @throws 令牌无效/过期/文件不存在时抛 ShareTokenError（403）
   */
  async downloadByShareToken(shareToken: string): Promise<{
    stream: Readable;
    filename: string;
    mimeType: string;
    size: number;
  }> {
    // 1. 校验令牌（签名 + 过期）
    const payload = shareTokenService.verify(shareToken);

    // 2. 查询文件（注意：下载不强制 is_public，因为分享链接即授权）
    const file = await fileRepository.findById(payload.fileId);
    if (!file) {
      // 文件不存在统一返回 403，避免泄露文件是否存在
      const { ShareTokenError } = await import('./ShareTokenService.js');
      throw new ShareTokenError('分享链接无效');
    }

    // 3. 获取文件流
    const stream = await localStorageProvider.getStream(file.storageKey);

    return {
      stream,
      filename: file.originalName,
      mimeType: file.mimeType,
      size: Number(file.size),
    };
  }

  /**
   * 在线预览（纯文本/图片）
   * @param id 文件 ID
   * @param maxBytes 最大读取字节数
   */
  async getPreviewContent(id: string, maxBytes?: number): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
    const file = await fileRepository.findById(id, true);
    if (!file) throw new Error('文件不存在或不可预览');
    const buffer = await localStorageProvider.getBuffer(file.storageKey, maxBytes);
    return { buffer, mimeType: file.mimeType, ext: file.ext };
  }
}

export const fileService = new FileService();
