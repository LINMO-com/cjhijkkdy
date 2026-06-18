<script setup lang="ts">
/**
 * Toast 通知容器
 * ----------------------------------------------------------------------------
 * 固定在右上角，展示 useToast 推送的消息
 */
import { useToast } from '@/composables/useToast';

const { toasts, remove } = useToast();

// 类型 → 样式映射
const typeClass: Record<string, string> = {
  success: 'border-lime-400/50 bg-lime-400/10 text-lime-300',
  error: 'border-red-500/50 bg-red-500/10 text-red-300',
  info: 'border-sky-500/50 bg-sky-500/10 text-sky-300',
};
</script>

<template>
  <Teleport to="body">
    <div class="fixed right-4 top-4 z-[100] flex flex-col gap-2">
      <transition-group name="toast" tag="div" class="flex flex-col gap-2">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="['flex items-center gap-2 rounded-lg border px-4 py-2 text-sm shadow-lg backdrop-blur', typeClass[t.type]]"
          @click="remove(t.id)"
        >
          <span>{{ t.message }}</span>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<style scoped>
/* toast 进出动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
