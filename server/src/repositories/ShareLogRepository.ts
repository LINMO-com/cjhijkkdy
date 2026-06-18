/**
 * 分享日志数据访问层 ShareLogRepository
 * ----------------------------------------------------------------------------
 * 记录每次生成的分享链接，用于审计与统计
 * 注意：分享校验是无状态的（HMAC），此表不参与校验逻辑
 */
import { ShareLog } from '../models/ShareLog.js';

export class ShareLogRepository {
  /**
   * 记录分享链接生成
   */
  async create(data: {
    id: string;
    fileId: string;
    shareToken: string;
    sizeTier: 'normal' | 'large';
    expireAt: Date;
  }): Promise<ShareLog> {
    return ShareLog.create(data);
  }

  /**
   * 查询某文件的所有分享记录（审计用）
   */
  async findByFileId(fileId: string): Promise<ShareLog[]> {
    return ShareLog.findAll({
      where: { fileId },
      order: [['created_at', 'DESC']],
    });
  }
}

export const shareLogRepository = new ShareLogRepository();
