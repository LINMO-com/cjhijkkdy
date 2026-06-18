/**
 * 应用入口 app.ts
 * ----------------------------------------------------------------------------
 * 创建 Express 应用，注册中间件、路由、错误处理，启动 HTTP 服务。
 */
import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config/index.js';
import { assertDatabaseConnection } from './models/index.js';
import { router } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/error.js';
import { securityHeaders, requestLogger } from './middlewares/security.js';
import { ensureStorageRoot } from './utils/pathSecurity.js';

/**
 * 创建并配置 Express 应用
 */
function createApp(): express.Application {
  const app = express();

  // 1. 基础中间件
  app.use(securityHeaders);
  app.use(requestLogger);
  app.use(cors({ origin: config.cors.origin, credentials: true }));
  // JSON / URL-encoded 解析，限制体大小防止 DoS
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // 2. 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ code: 0, message: 'ok', data: { status: 'healthy', time: new Date().toISOString() } });
  });

  // 3. 业务路由
  app.use(router);

  // 4. 404 处理
  app.use(notFoundHandler);

  // 5. 全局错误处理（必须最后注册，4 参数）
  app.use(errorHandler);

  return app;
}

/**
 * 启动服务
 */
async function bootstrap(): Promise<void> {
  // 1. 校验配置
  validateConfig();

  // 2. 确保存储根目录存在
  ensureStorageRoot();

  // 3. 测试数据库连接
  await assertDatabaseConnection();

  // 4. 创建应用
  const app = createApp();

  // 5. 启动 HTTP 服务
  app.listen(config.port, () => {
    console.log(`\n🚀 文档管理系统后端已启动`);
    console.log(`   监听端口: ${config.port}`);
    console.log(`   健康检查: http://localhost:${config.port}/api/health`);
    console.log(`   存储目录: ${config.storage.root}`);
    console.log(`   普通文件有效期: ${config.share.ttlNormalMinutes} 分钟`);
    console.log(`   大文件有效期: ${config.share.ttlLargeMinutes} 分钟\n`);
  });
}

// 启动（捕获未处理错误）
bootstrap().catch((err) => {
  console.error('❌ 启动失败:', err);
  process.exit(1);
});


