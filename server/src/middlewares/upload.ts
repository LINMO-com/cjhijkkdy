/**
 * 文件上传中间件（基于 Multer）
 * ----------------------------------------------------------------------------
 * 配置内存存储模式（文件先入内存，经安全校验后再落盘），
 * 限制单文件大小，过滤空文件。
 *
 * 安全策略：
 * - 内存存储：便于在落盘前做魔数校验
 * - 大小限制：防止超大文件耗尽内存
 * - 文件名安全：使用原始文件名仅用于提取扩展名，存储键由服务端生成
 */
import multer from 'multer';
import { config } from '../config/index.js';

/**
 * 创建 multer 实例
 * 使用 memoryStorage，文件暂存内存，业务层校验后再写入存储层
 */
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: config.storage.maxUploadSize, // 单文件大小限制
    files: 20, // 单次最多 20 个文件
  },
  fileFilter: (_req, file, cb) => {
    // 基础过滤：文件名非空
    if (!file.originalname) {
      cb(new Error('文件名不能为空'));
      return;
    }
    cb(null, true);
  },
});

/**
 * 单文件上传中间件
 * 字段名: file
 */
export const uploadSingle = upload.single('file');

/**
 * 多文件上传中间件
 * 字段名: files，最多 20 个
 */
export const uploadArray = upload.array('files', 20);
