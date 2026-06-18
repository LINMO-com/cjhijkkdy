/**
 * Sequelize 实例与数据库连接
 * ----------------------------------------------------------------------------
 * 集中创建 Sequelize 实例，配置连接池、日志、时区等。
 * 所有模型在此注册并建立关联关系。
 */
import { Sequelize } from 'sequelize';
import { config } from '../config/index.js';
import { AdminModelFactory } from './Admin.js';
import { FileModelFactory } from './File.js';
import { ShareLogModelFactory } from './ShareLog.js';

/**
 * 创建 Sequelize 实例
 * 使用 mysql2 驱动，连接参数从配置读取
 */
export const sequelize = new Sequelize(
  config.db.name,
  config.db.user,
  config.db.password,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: 'mysql',
    // 连接池配置
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    // 时区设置为 +08:00（东八区）
    timezone: '+08:00',
    // 生产环境关闭 SQL 日志，开发环境打印到控制台
    logging: process.env.NODE_ENV === 'production' ? false : (msg) => console.debug('[SQL]', msg),
    define: {
      // 关闭自动创建 createdAt/updatedAt 的驼峰转换，由模型显式定义
      timestamps: true,
      underscored: true, // 列名使用 snake_case
      freezeTableName: true, // 表名与模型名一致，不加复数
    },
  },
);

// ----------------------------------------------------------------------------
// 注册模型
// ----------------------------------------------------------------------------
export const Admin = AdminModelFactory(sequelize);
export const File = FileModelFactory(sequelize);
export const ShareLog = ShareLogModelFactory(sequelize);

// ----------------------------------------------------------------------------
// 建立模型关联关系
// ----------------------------------------------------------------------------
// 一个管理员可管理多个文件（通过 created_by，此处简化为审计字段，暂不建外键）
// 一个文件可生成多个分享记录
File.hasMany(ShareLog, { foreignKey: 'file_id', as: 'shareLogs' });
ShareLog.belongsTo(File, { foreignKey: 'file_id', as: 'file' });

/**
 * 测试数据库连接
 */
export async function assertDatabaseConnection(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
  } catch (err) {
    console.error('❌ 数据库连接失败:', err);
    throw err;
  }
}
