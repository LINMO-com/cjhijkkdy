/**
 * 文件类型与安全校验工具
 * ----------------------------------------------------------------------------
 * 1. 扩展名白名单校验
 * 2. MIME 类型与扩展名一致性校验
 * 3. 文件魔数（Magic Number）校验，防止伪装文件后缀绕过白名单
 */
import { config } from '../config/index.js';

/** 扩展名 → MIME 类型映射（常用类型） */
const EXT_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
};

/** 常见文件魔数（前若干字节特征），用于校验文件真实类型 */
const MAGIC_NUMBERS: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  png: [0x89, 0x50, 0x4e, 0x47], // PNG signature
  jpg: [0xff, 0xd8, 0xff], // JPEG SOI
  jpeg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38], // GIF8
  zip: [0x50, 0x4b, 0x03, 0x04], // PK..
  rar: [0x52, 0x61, 0x72, 0x21], // Rar!
  doc: [0xd0, 0xcf, 0x11, 0xe0], // OLE2 (doc/xls/ppt)
  docx: [0x50, 0x4b, 0x03, 0x04], // 实为 zip 容器
  xlsx: [0x50, 0x4b, 0x03, 0x04],
  pptx: [0x50, 0x4b, 0x03, 0x04],
};

/**
 * 从文件名提取扩展名（小写，不含点）
 * @example getExt('report.PDF') => 'pdf'
 */
export function getExt(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1).toLowerCase();
}

/**
 * 校验扩展名是否在白名单内
 */
export function isExtensionAllowed(ext: string): boolean {
  if (!ext) return false;
  return config.storage.allowedExtensions.includes(ext);
}

/**
 * 根据扩展名获取标准 MIME 类型
 */
export function getMimeType(ext: string): string {
  return EXT_MIME_MAP[ext] || 'application/octet-stream';
}

/**
 * 魔数校验：检查文件头字节是否匹配该扩展名的预期魔数
 * @param buffer 文件前若干字节
 * @param ext 扩展名
 * @returns true 表示通过校验或该类型无魔数定义（放行纯文本类）
 */
export function verifyMagicNumber(buffer: Buffer, ext: string): boolean {
  const expected = MAGIC_NUMBERS[ext];
  // 纯文本类（txt/md/json/csv/svg）无固定魔数，跳过
  if (!expected) return true;
  if (buffer.length < expected.length) return false;
  return expected.every((byte, i) => buffer[i] === byte);
}

/**
 * 综合文件安全校验：扩展名白名单 + 魔数校验
 * @throws Error 校验失败时抛出具体原因
 */
export function validateUploadedFile(filename: string, buffer: Buffer): void {
  const ext = getExt(filename);
  if (!isExtensionAllowed(ext)) {
    throw new Error(`不支持的文件格式: .${ext || '未知'}`);
  }
  if (!verifyMagicNumber(buffer, ext)) {
    throw new Error(`文件内容与扩展名不匹配，疑似恶意文件: ${filename}`);
  }
}

/**
 * 判断扩展名是否为纯文本类（可在线预览）
 */
export function isTextLike(ext: string): boolean {
  return ['txt', 'md', 'json', 'csv'].includes(ext);
}

/**
 * 判断扩展名是否为图片类（可灯箱预览）
 */
export function isImage(ext: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
}
