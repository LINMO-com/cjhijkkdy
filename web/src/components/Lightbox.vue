<script setup lang="ts">
/**
 * 图片灯箱组件
 * ----------------------------------------------------------------------------
 * 全屏遮罩 + 居中大图，点击遮罩或 ESC 关闭
 */
import { onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  src: string;
  alt?: string;
}>();

const emit = defineEmits<{ close: [] }>();

/** ESC 关闭 */
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      @click="emit('close')"
    >
      <img
        :src="props.src"
        :alt="props.alt || ''"
        class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        @click.stop
      />
      <button
        class="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-space-700/80 text-slate-300 transition hover:bg-space-600"
        @click="emit('close')"
        aria-label="关闭"
      >
        ✕
      </button>
    </div>
  </Teleport>
</template>
