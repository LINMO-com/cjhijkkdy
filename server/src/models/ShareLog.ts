/**
 * ShareLog 分享日志模型
 * ----------------------------------------------------------------------------
 * 对应数据库 share_log 表，记录每次生成的分享链接（审计用途）
 * 注意：分享链接校验是无状态的（基于 HMAC），此表仅作记录，不参与校验
 */
import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

/** ShareLog 实例属性类型 */
export interface ShareLogAttributes {
  id: string;
  fileId: string;
  shareToken: string;
  sizeTier: 'normal' | 'large';
  expireAt: Date;
  createdAt: Date;
}

/**
 * ShareLog 模型类
 */
export class ShareLog extends Model<InferAttributes<ShareLog>, InferCreationAttributes<ShareLog>> implements ShareLogAttributes {
  declare id: CreationOptional<string>;
  declare fileId: string;
  declare shareToken: string;
  declare sizeTier: 'normal' | 'large';
  declare expireAt: Date;
  declare createdAt: CreationOptional<Date>;
}

/**
 * 模型工厂：定义字段映射与选项
 */
export function ShareLogModelFactory(sequelize: Sequelize): typeof ShareLog {
  ShareLog.init(
    {
      id: {
        type: DataTypes.STRING(36),
        primaryKey: true,
        allowNull: false,
      },
      fileId: {
        type: DataTypes.STRING(36),
        allowNull: false,
        field: 'file_id',
        comment: '关联文件ID',
      },
      shareToken: {
        type: DataTypes.STRING(512),
        allowNull: false,
        field: 'share_token',
        comment: '分享令牌',
      },
      sizeTier: {
        type: DataTypes.STRING(16),
        allowNull: false,
        field: 'size_tier',
        comment: '文件大小等级',
      },
      expireAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expire_at',
        comment: '过期时间',
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'share_log',
      modelName: 'ShareLog',
      updatedAt: false, // 无更新时间
    },
  );
  return ShareLog;
}
