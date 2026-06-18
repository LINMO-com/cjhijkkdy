/**
 * Toast 通知 composable
 * ----------------------------------------------------------------------------
 * 全局轻量级消息提示，无需引入额外 UI 库
 */
import { ref } from 'vue';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

const toasts = ref<ToastItem[]>([]);
let seq = 0;

/**
 * 推送一条 toast
 */
function push(type: ToastItem['type'], message: string, duration = 3000): void {
  const id = ++seq;
  toasts.value.push({ id, type, message });
  setTimeout(() => {
    remove(id);
  }, duration);
}

/** 移除指定 toast */
function remove(id: number): void {
  const idx = toasts.value.findIndex((t) => t.id === id);
  if (idx >= 0) toasts.value.splice(idx, 1);
}

export function useToast() {
  return {
    toasts,
    success: (msg: string) => push('success', msg),
    error: (msg: string) => push('error', msg),
    info: (msg: string) => push('info', msg),
    remove,
  };
}
