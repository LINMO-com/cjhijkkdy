<script setup lang="ts">
/**
 * 拖拽上传区组件
 * ----------------------------------------------------------------------------
 * 支持点击选择与拖拽上传，展示文件队列与上传进度
 * 通过 emit('upload', files) 将文件交给父组件处理实际上传逻辑
 */
import { ref, computed } from 'vue';
import FileIcon from './FileIcon.vue';
import { formatSize } from '@/utils/format';
import { getExt } from '@/utils/file';

const props = defineProps<{
  /** 已选文件列表 */
  modelValue: File[];
  /** 是否上传中 */
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [files: File[]];
  upload: [files: File[]];
}>();

const isDragging = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

/** 选择文件 */
function selectFiles(files: FileList | null): void {
  if (!files || files.length === 0) return;
  const arr = Array.from(files);
  emit('update:modelValue', [...props.modelValue, ...arr]);
}

/** 处理拖拽进入 */
function onDragover(e: DragEvent): void {
  e.preventDefault();
  isDragging.value = true;
}

/** 处理拖拽离开 */
function onDragleave(): void {
  isDragging.value = false;
}

/** 处理拖拽放下 */
function onDrop(e: DragEvent): void {
  e.preventDefault();
  isDragging.value = false;
  selectFiles(e.dataTransfer?.files || null);
}

/** 触发文件选择 */
function triggerSelect(): void {
  inputRef.value?.click();
}

/** 移除待上传文件 */
function removeFile(idx: number): void {
  const next = [...props.modelValue];
  next.splice(idx, 1);
  emit('update:modelValue', next);
}

/** 总大小 */
const totalSize = computed(() => props.modelValue.reduce((s, f) => s + f.size, 0));
</script>

<template>
  <div class="space-y-4">
    <!-- 拖拽区 -->
    <div
      :class="[
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition',
        isDragging ? 'border-lime-400 bg-lime-400/5' : 'border-space-600 bg-space-800/50 hover:border-slate-500',
      ]"
      @dragover="onDragover"
      @dragleave="onDragleave"
      @drop="onDrop"
      @click="triggerSelect"
    >
      <input
        ref="inputRef"
        type="file"
        multiple
        class="hidden"
        @change="(e) => selectFiles((e.target as HTMLInputElement).files)"
      />
      <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-lime-400/10 text-lime-400">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v12m0-12l-4 4m4-4l4 4M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <p class="text-sm text-slate-300">
        <span class="font-medium text-lime-400">点击选择</span> 或拖拽文件到此处
      </p>
      <p class="mt-1 text-xs text-slate-500">支持多文件上传，单文件最大 500MB</p>
    </div>

    <!-- 文件队列 -->
    <div v-if="modelValue.length > 0" class="space-y-2">
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>共 {{ modelValue.length }} 个文件，{{ formatSize(totalSize) }}</span>
        <button class="text-lime-400 hover:underline" @click="emit('upload', modelValue)" :disabled="loading">
          {{ loading ? '上传中...' : '开始上传' }}
        </button>
      </div>
      <div
        v-for="(f, idx) in modelValue"
        :key="idx"
        class="flex items-center gap-3 rounded-lg border border-space-600 bg-space-800/60 p-3"
      >
        <FileIcon :ext="getExt(f.name)" size="sm" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-slate-200">{{ f.name }}</p>
          <p class="text-xs text-slate-500">{{ formatSize(f.size) }}</p>
        </div>
        <button
          v-if="!loading"
          class="text-slate-500 transition hover:text-red-400"
          @click="removeFile(idx)"
          aria-label="移除"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>
