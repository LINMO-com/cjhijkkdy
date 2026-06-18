/**
 * Admin 管理员模型
 * ----------------------------------------------------------------------------
 * 对应数据库 admin 表，存储后台管理员账号
 */
import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

/** Admin 实例属性类型 */
export interface AdminAttributes {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
}

/**
 * Admin 模型类
 */
export class Admin extends Model<InferAttributes<Admin>, InferCreationAttributes<Admin>> implements AdminAttributes {
  declare id: CreationOptional<string>;
  declare username: string;
  declare passwordHash: string;
  declare createdAt: CreationOptional<Date>;
}

/**
 * 模型工厂：定义字段映射与选项
 */
export function AdminModelFactory(sequelize: Sequelize): typeof Admin {
  Admin.init(
    {
      id: {
        type: DataTypes.STRING(36),
        primaryKey: true,
        allowNull: false,
        comment: '管理员唯一ID',
      },
      username: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        comment: '登录用户名',
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'password_hash', // 数据库列名为 snake_case
        comment: 'bcrypt 密码哈希',
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'admin',
      modelName: 'Admin',
      // Admin 表无 updatedAt
      updatedAt: false,
    },
  );
  return Admin;
}
