/**
 * 配置加载模块
 * ----------------------------------------------------------------------------
 * 统一从环境变量读取配置，启动时校验关键项，避免运行时才发现配置缺失。
 * 所有敏感信息（密钥、数据库密码）仅在此处集中读取，不散落在各业务模块。
 */
import dotenv from 'dotenv';
import path from 'node:path';

// 加载 .env 文件（与源码同级目录）
dotenv.config();

/**
 * 应用配置对象
 * 使用 getter 确保路径始终基于运行时目录解析
 */
export const config = {
  // 服务端口
  port: parseInt(process.env.PORT || '3000', 10),

  // 数据库配置
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'doc_share',
  },

  // JWT 鉴权配置（管理员登录令牌）
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  // 分享链接 HMAC 签名配置（核心安全项）
  share: {
    // HMAC-SHA256 签名密钥，生产环境必须替换为高强度随机字符串
    secret: process.env.SHARE_SECRET || 'dev_share_secret_change_me_to_64_chars_random_string',
    // 普通文件有效期（分钟）
    ttlNormalMinutes: parseInt(process.env.SHARE_TTL_NORMAL_MINUTES || '15', 10),
    // 大文件有效期（分钟）
    ttlLargeMinutes: parseInt(process.env.SHARE_TTL_LARGE_MINUTES || '30', 10),
    // 大文件阈值（字节），默认 100MB
    largeFileThreshold: parseInt(process.env.LARGE_FILE_THRESHOLD_BYTES || '104857600', 10),
  },

  // 文件存储配置
  storage: {
    // 本地存储根目录，解析为绝对路径
    root: path.resolve(process.env.STORAGE_ROOT || './storage'),
    // 允许上传的扩展名白名单（小写，无点）
    allowedExtensions: (process.env.ALLOWED_EXTENSIONS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    // 单文件最大上传大小（字节）
    maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '524288000', 10),
  },

  // 跨域配置
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim()),
  },
} as const;

/**
 * 启动时校验关键配置
 * 生产环境若关键密钥为默认值，直接抛错阻止启动
 */
export function validateConfig(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const warnings: string[] = [];

  if (config.share.secret.includes('change_me')) {
    if (isProd) {
      throw new Error('[配置错误] 生产环境必须设置 SHARE_SECRET 环境变量');
    }
    warnings.push('SHARE_SECRET 使用默认值，生产环境务必修改');
  }

  if (config.jwt.secret.includes('change_me')) {
    if (isProd) {
      throw new Error('[配置错误] 生产环境必须设置 JWT_SECRET 环境变量');
    }
    warnings.push('JWT_SECRET 使用默认值，生产环境务必修改');
  }

  if (warnings.length > 0) {
    console.warn('⚠️  配置警告:\n' + warnings.map((w) => `   - ${w}`).join('\n'));
  }
}
