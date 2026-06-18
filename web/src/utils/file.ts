/**
 * 前端文件类型工具
 * ----------------------------------------------------------------------------
 * 与后端 fileType.ts 对齐的轻量版，用于前端展示判断
 */

/** 从文件名提取扩展名（小写，不含点） */
export function getExt(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1).toLowerCase();
}

/** 是否为纯文本类（可在线预览） */
export function isTextLike(ext: string): boolean {
  return ['txt', 'md', 'json', 'csv'].includes(ext.toLowerCase());
}

/** 是否为图片类（可灯箱预览） */
export function isImage(ext: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext.toLowerCase());
}
