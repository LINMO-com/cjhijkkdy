<script setup lang="ts">
/**
 * 公开网页 - 首页
 * ----------------------------------------------------------------------------
 * 以卡片墙形式展示所有公开文件，支持格式筛选与关键词搜索
 * 点击文本/图片类文件可在线预览
 */
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { fileApi } from '@/api';
import { useToast } from '@/composables/useToast';
import { formatSize, formatDate } from '@/utils/format';
import { isTextLike, isImage, getExt } from '@/utils/file';
import FileIcon from '@/components/FileIcon.vue';
import type { FileDTO } from '@/types';

const router = useRouter();
const toast = useToast();

const list = ref<FileDTO[]>([]);
const total = ref(0);
const loading = ref(false);

const filter = reactive({
  ext: '',
  keyword: '',
  page: 1,
  pageSize: 24,
});

/** 加载公开文件列表 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: filter.page, pageSize: filter.pageSize };
    if (filter.ext) params.ext = filter.ext;
    if (filter.keyword) params.keyword = filter.keyword;
    const res = await fileApi.list(params);
    list.value = res.list;
    total.value = res.total;
  } catch (err) {
    toast.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}

/** 格式选项 */
const extOptions = computed(() => {
  const set = new Set(list.value.map((f) => f.ext));
  return Array.from(set);
});

/** 点击文件：可预览的跳转预览页，否则提示需分享链接下载 */
function onClickFile(file: FileDTO): void {
  if (isTextLike(file.ext) || isImage(file.ext)) {
    router.push(`/preview/${file.id}`);
  } else {
    toast.info('该格式需通过分享链接下载');
  }
}

onMounted(loadList);
</script>

<template>
  <div class="min-h-screen bg-space-900">
    <!-- 顶部导航 -->
    <header class="sticky top-0 z-20 border-b border-space-600 bg-space-900/80 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-400 font-display text-base font-bold text-space-900">D</div>
          <div>
            <h1 class="font-display text-lg font-bold text-slate-100">文档中心</h1>
            <p class="text-xs text-slate-500">企业文档公开浏览</p>
          </div>
        </div>
        <router-link to="/admin/login" class="text-xs text-slate-500 transition hover:text-lime-400">管理后台</router-link>
      </div>
    </header>

    <!-- Hero 区 -->
    <section class="relative overflow-hidden border-b border-space-600">
      <div class="pointer-events-none absolute inset-0">
        <div class="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-lime-400/10 blur-3xl"></div>
        <div class="absolute right-1/4 bottom-0 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl"></div>
      </div>
      <div class="relative mx-auto max-w-7xl px-6 py-16 text-center">
        <h2 class="font-display text-4xl font-bold tracking-tight text-slate-100">
          多模态文档<span class="text-lime-400">·</span>安全分享
        </h2>
        <p class="mx-auto mt-4 max-w-xl text-sm text-slate-400">
          统一存储企业文档资产，支持在线预览与限时安全下载，过期链接自动失效。
        </p>
      </div>
    </section>

    <main class="mx-auto max-w-7xl px-6 py-8">
      <!-- 筛选栏 -->
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <select v-model="filter.ext" class="input-field !w-auto !py-1.5" @change="loadList">
          <option value="">全部格式</option>
          <option v-for="e in extOptions" :key="e" :value="e">{{ e.toUpperCase() }}</option>
        </select>
        <input
          v-model="filter.keyword"
          type="text"
          class="input-field !w-64 !py-1.5"
          placeholder="搜索文档..."
          @keyup.enter="loadList"
        />
        <button class="btn-secondary !py-1.5" @click="loadList">搜索</button>
        <div class="flex-1" />
        <span class="text-xs text-slate-500">共 {{ total }} 个文档</span>
      </div>

      <!-- 加载骨架 -->
      <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div v-for="i in 8" :key="i" class="h-40 animate-pulse rounded-xl bg-space-700/50"></div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="list.length === 0" class="flex flex-col items-center justify-center py-24 text-slate-500">
        <p class="text-sm">暂无公开文档</p>
      </div>

      <!-- 文件卡片墙 -->
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="f in list"
          :key="f.id"
          class="card group cursor-pointer p-5 transition hover:border-lime-400/40 hover:shadow-lg hover:shadow-lime-400/5"
          @click="onClickFile(f)"
        >
          <div class="mb-4 flex items-start justify-between">
            <FileIcon :ext="f.ext" size="lg" />
            <span
              v-if="isTextLike(f.ext) || isImage(f.ext)"
              class="rounded-full bg-lime-400/10 px-2 py-0.5 text-[10px] text-lime-400"
            >可预览</span>
          </div>
          <p class="truncate font-medium text-slate-200">{{ f.title || f.originalName }}</p>
          <p class="mt-1 truncate text-xs text-slate-500">{{ f.originalName }}</p>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{{ formatSize(f.size) }}</span>
            <span>{{ formatDate(f.createdAt).slice(0, 10) }}</span>
          </div>
          <!-- 标签 -->
          <div v-if="f.tags && f.tags.length > 0" class="mt-3 flex flex-wrap gap-1">
            <span
              v-for="t in f.tags.slice(0, 3)"
              :key="t"
              class="rounded bg-space-600/60 px-1.5 py-0.5 text-[10px] text-slate-400"
            >{{ t }}</span>
          </div>
        </div>
      </div>
    </main>

    <footer class="border-t border-space-600 py-6 text-center text-xs text-slate-600">
      企业级多模态文档管理与分享系统 · 安全限时下载
    </footer>
  </div>
</template>
