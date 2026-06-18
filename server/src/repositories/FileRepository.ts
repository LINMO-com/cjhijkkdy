/**
 * 文件数据访问层 FileRepository
 * ----------------------------------------------------------------------------
 * 封装对 File 表的所有数据库操作，业务层通过 Repository 访问数据，
 * 便于切换数据源或添加缓存层。
 */
import { Op } from 'sequelize';
import { File } from '../models/File.js';
import type { FileAttributes } from '../models/File.js';
import type { FileQuery, FileUpdateInput } from '../types/index.js';

/** 文件列表查询结果 */
export interface FileListResult {
  list: File[];
  total: number;
  page: number;
  pageSize: number;
}

export class FileRepository {
  /**
   * 创建文件记录
   */
  async create(data: Omit<FileAttributes, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<FileAttributes, 'id'>>): Promise<File> {
    return File.create(data as File);
  }

  /**
   * 根据 ID 查询文件
   * @param publicOnly 是否仅查公开文件
   */
  async findById(id: string, publicOnly = false): Promise<File | null> {
    const where: Record<string, unknown> = { id };
    if (publicOnly) where.is_public = true;
    return File.findOne({ where });
  }

  /**
   * 文件列表查询（支持筛选、分页）
   */
  async findMany(query: FileQuery): Promise<FileListResult> {
    const { ext, category, tag, keyword, page = 1, pageSize = 20, publicOnly = false } = query;
    const where: Record<string, unknown> = {};

    if (publicOnly) where.is_public = true;
    if (ext) where.ext = ext;
    if (category) where.category = category;
    // 标签查询：JSON 数组包含
    if (tag) {
      // MySQL JSON_CONTAINS 函数
      where.tags = { [Op.contains]: [tag] } as unknown as string[];
    }
    // 关键词搜索：标题或原始文件名模糊匹配
    if (keyword) {
      where[Op.or as unknown as string] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { original_name: { [Op.like]: `%${keyword}%` } },
      ];
    }

    const offset = (page - 1) * pageSize;
    const { rows, count } = await File.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
    });

    return { list: rows, total: count, page, pageSize };
  }

  /**
   * 更新文件元数据
   */
  async update(id: string, input: FileUpdateInput): Promise<[number]> {
    return File.update(input, { where: { id } });
  }

  /**
   * 更新存储键（重命名时同步底层存储）
   */
  async updateStorageKey(id: string, storageKey: string, originalName: string): Promise<[number]> {
    return File.update({ storageKey, originalName }, { where: { id } });
  }

  /**
   * 同名文件冲突检测：检查是否存在同名文件（排除自身）
   */
  async existsByOriginalName(originalName: string, excludeId?: string): Promise<boolean> {
    const where: Record<string, unknown> = { original_name: originalName };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    const count = await File.count({ where });
    return count > 0;
  }

  /**
   * 删除文件记录
   */
  async delete(id: string): Promise<number> {
    return File.destroy({ where: { id } });
  }

  /**
   * 获取所有分类（去重）
   */
  async findCategories(): Promise<string[]> {
    const rows = await File.findAll({
      attributes: ['category'],
      group: ['category'],
      raw: true,
    });
    return rows.map((r) => (r as { category: string }).category);
  }
}

// 导出单例，业务层共用
export const fileRepository = new FileRepository();
