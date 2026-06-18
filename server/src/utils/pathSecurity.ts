/**
 * 路径安全工具
 * ----------------------------------------------------------------------------
 * 防止路径遍历攻击（Path Traversal）：
 * - storageKey 由服务端生成，绝不接受客户端传入的路径
 * - 所有文件操作前，校验解析后的绝对路径必须位于存储根目录内
 */
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config/index.js';

/**
 * 校验给定 storageKey 解析后的绝对路径是否位于存储根目录内
 * @param storageKey 服务端生成的存储键（如 2026/06/uuid.pdf）
 * @returns 安全的绝对路径
 * @throws 若检测到路径遍历则抛错
 */
export function resolveSafePath(storageKey: string): string {
  // 规范化存储根目录为绝对路径
  const root = path.resolve(config.storage.root);
  // path.join 会处理 ../，再 resolve 为绝对路径
  const target = path.resolve(root, storageKey);

  // 确保目标路径以根目录开头（防止 ../ 逃逸）
  // 使用 path.relative 判断：若结果以 .. 开头则说明在根目录之外
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('非法路径：检测到路径遍历攻击');
  }
  return target;
}

/**
 * 确保存储根目录存在
 */
export function ensureStorageRoot(): void {
  const root = config.storage.root;
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
}

/**
 * 生成安全的存储键
 * 格式：yyyy/mm/uuid.ext
 * - 按年月分目录，避免单目录文件过多
 * - 使用 UUID 作为文件名，与原始文件名解耦，防遍历
 */
export function generateStorageKey(ext: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  // 动态导入 uuid 避免在工具模块顶层引入
  // 此处使用 crypto.randomUUID()（Node 16+ 内置）
  const uuid = globalThis.crypto.randomUUID();
  return `${yyyy}/${mm}/${uuid}.${ext}`;
}
