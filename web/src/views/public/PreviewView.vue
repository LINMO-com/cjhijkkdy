<script setup lang="ts">
/**
 * 公开网页 - 在线预览页
 * ----------------------------------------------------------------------------
 * - 纯文本类（txt/md/json/csv）：网页端直接渲染
 * - 图片类：灯箱预览
 * - 其他格式：提示需通过分享链接下载
 */
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fileApi } from '@/api';
import { useToast } from '@/composables/useToast';
import { formatSize, formatDate } from '@/utils/format';
import { isTextLike, isImage } from '@/utils/file';
import { marked } from 'marked';
import FileIcon from '@/components/FileIcon.vue';
import Lightbox from '@/components/Lightbox.vue';
import type { FileDTO, PreviewResult } from '@/types';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const fileId = route.params.fileId as string;
const file = ref<FileDTO | null>(null);
const preview = ref<PreviewResult | null>(null);
const loading = ref(false);
const lightboxOpen = ref(false);

/** 是否 Markdown */
const isMarkdown = computed(() => file.value?.ext === 'md');

/** 渲染后的 Markdown HTML */
const renderedMarkdown = computed(() => {
  if (!preview.value || !isMarkdown.value) return '';
  try {
    return marked.parse(preview.value.content, { async: false }) as string;
  } catch {
    return '<p>Markdown 渲染失败</p>';
  }
});

/** 加载文件详情与预览内容 */
async function loadPreview(): Promise<void> {
  loading.value = true;
  try {
    file.value = await fileApi.getById(fileId);
    if (isTextLike(file.value.ext)) {
      preview.value = await fileApi.preview(fileId);
    } else if (isImage(file.value.ext)) {
      // 图片直接通过 URL 加载，点击打开灯箱
      lightboxOpen.value = true;
    } else {
      toast.info('该格式不支持在线预览');
    }
  } catch (err) {
    toast.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(loadPreview);
</script>

<template>
  <div class="min-h-screen bg-space-900">
    <header class="sticky top-0 z-20 border-b border-space-600 bg-space-900/80 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <button class="text-sm text-slate-400 transition hover:text-lime-400" @click="router.push('/')">← 返回列表</button>
        <span class="font-display text-sm font-semibold text-slate-200">在线预览</span>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-6 py-8">
      <div v-if="loading" class="space-y-3">
        <div class="h-20 animate-pulse rounded-lg bg-space-700/50"></div>
        <div class="h-96 animate-pulse rounded-lg bg-space-700/50"></div>
      </div>

      <div v-else-if="file" class="space-y-6">
        <!-- 文件信息 -->
        <div class="card flex items-center gap-4 p-5">
          <FileIcon :ext="file.ext" size="lg" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-slate-200">{{ file.title || file.originalName }}</p>
            <div class="mt-1 flex gap-4 text-xs text-slate-500">
              <span>{{ formatSize(file.size) }}</span>
              <span>{{ file.mimeType }}</span>
              <span>{{ formatDate(file.createdAt) }}</span>
            </div>
          </div>
        </div>

        <!-- 文本预览 -->
        <div v-if="preview && !isMarkdown" class="card overflow-hidden">
          <div class="border-b border-space-600 px-4 py-2 text-xs text-slate-400">
            {{ file.ext.toUpperCase() }} 文件内容
          </div>
          <pre class="max-h-[70vh] overflow-auto p-4 font-mono text-sm leading-relaxed text-slate-300">{{ preview.content }}</pre>
        </div>

        <!-- Markdown 预览 -->
        <div v-else-if="preview && isMarkdown" class="card overflow-hidden">
          <div class="border-b border-space-600 px-4 py-2 text-xs text-slate-400">Markdown 渲染</div>
          <div class="markdown-body max-h-[70vh] overflow-auto p-6 text-sm leading-relaxed text-slate-300" v-html="renderedMarkdown"></div>
        </div>

        <!-- 图片预览 -->
        <div v-else-if="isImage(file.ext)" class="card flex items-center justify-center p-8">
          <img
            :src="fileApi.previewImageUrl(file.id)"
            :alt="file.originalName"
            class="max-h-[70vh] cursor-zoom-in rounded-lg object-contain"
            @click="lightboxOpen = true"
          />
        </div>

        <!-- 不支持预览 -->
        <div v-else class="card flex flex-col items-center justify-center py-16 text-slate-500">
          <FileIcon :ext="file.ext" size="lg" />
          <p class="mt-4 text-sm">该格式不支持在线预览</p>
        </div>
      </div>
    </main>

    <!-- 图片灯箱 -->
    <Lightbox v-if="lightboxOpen && file" :src="fileApi.previewImageUrl(file.id)" :alt="file.originalName" @close="lightboxOpen = false" />
  </div>
</template>

<style scoped>
/* Markdown 渲染基础样式 */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  @apply font-display font-semibold text-slate-100 mt-4 mb-2;
}
.markdown-body :deep(h1) { @apply text-xl; }
.markdown-body :deep(h2) { @apply text-lg; }
.markdown-body :deep(h3) { @apply text-base; }
.markdown-body :deep(p) { @apply my-2; }
.markdown-body :deep(code) { @apply bg-space-800 px-1.5 py-0.5 rounded text-lime-400 font-mono text-xs; }
.markdown-body :deep(pre) { @apply bg-space-800 p-3 rounded-lg overflow-x-auto my-3; }
.markdown-body :deep(pre code) { @apply bg-transparent p-0 text-slate-300; }
.markdown-body :deep(ul) { @apply list-disc pl-6 my-2; }
.markdown-body :deep(ol) { @apply list-decimal pl-6 my-2; }
.markdown-body :deep(a) { @apply text-lime-400 hover:underline; }
.markdown-body :deep(blockquote) { @apply border-l-2 border-space-600 pl-4 text-slate-400 my-3; }
</style>
