/**
 * File 文件模型
 * ----------------------------------------------------------------------------
 * 对应数据库 file 表，存储文件元数据与存储键
 * storage_key 为服务端生成，与用户可见 original_name 解耦，防止路径遍历
 */
import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

/** File 实例属性类型 */
export interface FileAttributes {
  id: string;
  originalName: string;
  storageKey: string;
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

/**
 * File 模型类
 */
export class File extends Model<InferAttributes<File>, InferCreationAttributes<File>> implements FileAttributes {
  declare id: CreationOptional<string>;
  declare originalName: string;
  declare storageKey: string;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare category: CreationOptional<string>;
  declare tags: CreationOptional<string[] | null>;
  declare mimeType: string;
  declare size: number;
  declare ext: string;
  declare isPublic: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

/**
 * 模型工厂：定义字段映射与选项
 */
export function FileModelFactory(sequelize: Sequelize): typeof File {
  File.init(
    {
      id: {
        type: DataTypes.STRING(36),
        primaryKey: true,
        allowNull: false,
      },
      originalName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'original_name',
        comment: '原始文件名',
      },
      storageKey: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'storage_key',
        comment: '存储键(服务端生成)',
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: '',
        comment: '文件标题',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '文件描述',
      },
      category: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: 'uncategorized',
        comment: '分类',
      },
      tags: {
        // JSON 类型，存储标签数组
        type: DataTypes.JSON,
        allowNull: true,
        comment: '标签数组',
        // 读取时确保返回数组
        get() {
          const raw = this.getDataValue('tags');
          return Array.isArray(raw) ? raw : raw ? JSON.parse(raw) : null;
        },
      },
      mimeType: {
        type: DataTypes.STRING(128),
        allowNull: false,
        field: 'mime_type',
        comment: 'MIME 类型',
      },
      size: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        comment: '文件大小(字节)',
      },
      ext: {
        type: DataTypes.STRING(16),
        allowNull: false,
        comment: '扩展名(小写)',
      },
      isPublic: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_public',
        comment: '是否公开',
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'file',
      modelName: 'File',
      indexes: [
        { fields: ['ext'] },
        { fields: ['category'] },
        { fields: ['created_at'] },
        { fields: ['is_public'] },
      ],
    },
  );
  return File;
}
