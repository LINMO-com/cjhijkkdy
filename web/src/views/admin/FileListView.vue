<script setup lang="ts">
/**
 * 管理后台 - 文件列表页
 * ----------------------------------------------------------------------------
 * 功能：
 * - 列表视图 / 网格视图切换
 * - 按格式、分类、关键词筛选
 * - 生成分享链接（核心：展示有效期与下载 URL）
 * - 重命名、删除、编辑入口
 */
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { adminFileApi } from '@/api';
import { useAdminStore } from '@/stores/admin';
import { useToast } from '@/composables/useToast';
import { formatSize, formatDate } from '@/utils/format';
import FileIcon from '@/components/FileIcon.vue';
import type { FileDTO, ShareTokenResult } from '@/types';

const router = useRouter();
const store = useAdminStore();
const toast = useToast();

// 列表数据
const list = ref<FileDTO[]>([]);
const total = ref(0);
const loading = ref(false);

// 视图模式：list 列表 / grid 网格
const viewMode = ref<'list' | 'grid'>('list');

// 筛选条件
const filter = reactive({
  ext: '',
  category: '',
  keyword: '',
  page: 1,
  pageSize: 20,
});

// 分享链接弹窗状态
const shareModal = reactive({
  visible: false,
  file: null as FileDTO | null,
  result: null as ShareTokenResult | null,
  generating: false,
});

/** 当前分享链接的完整 URL（用于展示与复制） */
const shareFullUrl = computed(() => {
  if (!shareModal.result) return '';
  return `${window.location.origin}${shareModal.result.downloadUrl}`;
});

/** 当前分享链接的过期时间（Date 对象，供 formatDate 使用） */
const shareExpireDate = computed(() => {
  if (!shareModal.result) return null;
  return new Date(shareModal.result.expireAt);
});

// 重命名弹窗状态
const renameModal = reactive({
  visible: false,
  file: null as FileDTO | null,
  newName: '',
  loading: false,
});

/** 加载文件列表 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: filter.page, pageSize: filter.pageSize };
    if (filter.ext) params.ext = filter.ext;
    if (filter.category) params.category = filter.category;
    if (filter.keyword) params.keyword = filter.keyword;
    const res = await adminFileApi.list(params);
    list.value = res.list;
    total.value = res.total;
  } catch (err) {
    toast.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}

/** 格式选项（从已有列表聚合） */
const extOptions = computed(() => {
  const set = new Set(list.value.map((f) => f.ext));
  return Array.from(set);
});

/** 生成分享链接 */
async function onGenerateShare(file: FileDTO): Promise<void> {
  shareModal.file = file;
  shareModal.visible = true;
  shareModal.result = null;
  shareModal.generating = true;
  try {
    shareModal.result = await adminFileApi.generateShare(file.id);
  } catch (err) {
    toast.error((err as Error).message);
    shareModal.visible = false;
  } finally {
    shareModal.generating = false;
  }
}

/** 复制分享链接到剪贴板 */
async function copyShareLink(): Promise<void> {
  if (!shareModal.result) return;
  try {
    await navigator.clipboard.writeText(shareFullUrl.value);
    toast.success('分享链接已复制');
  } catch {
    toast.info('请手动复制链接');
  }
}

/** 打开重命名弹窗 */
function openRename(file: FileDTO): void {
  renameModal.file = file;
  renameModal.newName = file.originalName;
  renameModal.visible = true;
}

/** 确认重命名 */
async function confirmRename(): Promise<void> {
  if (!renameModal.file) return;
  const name = renameModal.newName.trim();
  if (!name) {
    toast.error('文件名不能为空');
    return;
  }
  renameModal.loading = true;
  try {
    await adminFileApi.rename(renameModal.file.id, name);
    toast.success('重命名成功');
    renameModal.visible = false;
    await loadList();
  } catch (err) {
    toast.error((err as Error).message);
  } finally {
    renameModal.loading = false;
  }
}

/** 删除文件 */
async function onDelete(file: FileDTO): Promise<void> {
  if (!confirm(`确认删除文件「${file.originalName}」？此操作不可恢复。`)) return;
  try {
    await adminFileApi.delete(file.id);
    toast.success('删除成功');
    await loadList();
  } catch (err) {
    toast.error((err as Error).message);
  }
}

/** 登出 */
function onLogout(): void {
  store.logout();
  router.replace('/admin/login');
}

onMounted(loadList);
</script>

<template>
  <div class="min-h-screen bg-space-900">
    <!-- 顶部导航栏 -->
    <header class="sticky top-0 z-20 border-b border-space-600 bg-space-800/80 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div class="flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400 font-display text-sm font-bold text-space-900">D</div>
          <span class="font-display text-sm font-semibold text-slate-200">文档管理后台</span>
        </div>
        <div class="flex items-center gap-3 text-sm">
          <span class="text-slate-400">{{ store.username }}</span>
          <button class="btn-secondary !py-1 !px-3 !text-xs" @click="onLogout">登出</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-6 py-6">
      <!-- 工具栏 -->
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <button class="btn-primary !py-1.5" @click="router.push('/admin/upload')">+ 上传文件</button>

        <div class="flex-1" />

        <!-- 筛选器 -->
        <select v-model="filter.ext" class="input-field !w-auto !py-1.5" @change="loadList">
          <option value="">全部格式</option>
          <option v-for="e in extOptions" :key="e" :value="e">{{ e.toUpperCase() }}</option>
        </select>
        <input
          v-model="filter.keyword"
          type="text"
          class="input-field !w-48 !py-1.5"
          placeholder="搜索标题/文件名"
          @keyup.enter="loadList"
        />
        <button class="btn-secondary !py-1.5" @click="loadList">搜索</button>

        <!-- 视图切换 -->
        <div class="flex overflow-hidden rounded-lg border border-space-600">
          <button
            :class="['px-3 py-1.5 text-xs transition', viewMode === 'list' ? 'bg-lime-400 text-space-900' : 'text-slate-400 hover:bg-space-700']"
            @click="viewMode = 'list'"
          >列表</button>
          <button
            :class="['px-3 py-1.5 text-xs transition', viewMode === 'grid' ? 'bg-lime-400 text-space-900' : 'text-slate-400 hover:bg-space-700']"
            @click="viewMode = 'grid'"
          >网格</button>
        </div>
      </div>

      <!-- 加载骨架 -->
      <div v-if="loading" class="space-y-2">
        <div v-for="i in 5" :key="i" class="h-16 animate-pulse rounded-lg bg-space-700/50"></div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="list.length === 0" class="flex flex-col items-center justify-center py-20 text-slate-500">
        <p class="text-sm">暂无文件</p>
      </div>

      <!-- 列表视图 -->
      <div v-else-if="viewMode === 'list'" class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="border-b border-space-600 text-xs text-slate-400">
            <tr>
              <th class="px-4 py-3 text-left font-medium">文件</th>
              <th class="px-4 py-3 text-left font-medium">分类</th>
              <th class="px-4 py-3 text-left font-medium">大小</th>
              <th class="px-4 py-3 text-left font-medium">上传时间</th>
              <th class="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="f in list"
              :key="f.id"
              class="border-b border-space-600/50 transition hover:bg-space-700/40"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <FileIcon :ext="f.ext" size="sm" />
                  <div class="min-w-0">
                    <p class="truncate font-medium text-slate-200">{{ f.title || f.originalName }}</p>
                    <p class="truncate text-xs text-slate-500">{{ f.originalName }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-slate-400">{{ f.category }}</td>
              <td class="px-4 py-3 text-slate-400">{{ formatSize(f.size) }}</td>
              <td class="px-4 py-3 text-slate-400">{{ formatDate(f.createdAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-1">
                  <button class="rounded px-2 py-1 text-xs text-lime-400 hover:bg-lime-400/10" @click="onGenerateShare(f)">分享</button>
                  <button class="rounded px-2 py-1 text-xs text-sky-400 hover:bg-sky-400/10" @click="router.push(`/admin/edit/${f.id}`)">编辑</button>
                  <button class="rounded px-2 py-1 text-xs text-amber-400 hover:bg-amber-400/10" @click="openRename(f)">重命名</button>
                  <button class="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-400/10" @click="onDelete(f)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 网格视图 -->
      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="f in list" :key="f.id" class="card group p-4 transition hover:border-lime-400/40">
          <div class="mb-3 flex justify-center">
            <FileIcon :ext="f.ext" size="lg" />
          </div>
          <p class="truncate text-center text-sm font-medium text-slate-200">{{ f.title || f.originalName }}</p>
          <p class="mt-1 text-center text-xs text-slate-500">{{ formatSize(f.size) }}</p>
          <div class="mt-3 flex justify-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button class="rounded px-2 py-1 text-xs text-lime-400 hover:bg-lime-400/10" @click="onGenerateShare(f)">分享</button>
            <button class="rounded px-2 py-1 text-xs text-sky-400 hover:bg-sky-400/10" @click="router.push(`/admin/edit/${f.id}`)">编辑</button>
            <button class="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-400/10" @click="onDelete(f)">删除</button>
          </div>
        </div>
      </div>
    </main>

    <!-- 分享链接弹窗 -->
    <Teleport to="body">
      <div v-if="shareModal.visible" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" @click.self="shareModal.visible = false">
        <div class="card w-full max-w-lg p-6">
          <h3 class="mb-4 font-display text-lg font-semibold text-slate-100">分享链接</h3>
          <div v-if="shareModal.generating" class="py-8 text-center text-sm text-slate-400">生成中...</div>
          <div v-else-if="shareModal.result" class="space-y-4">
            <div class="rounded-lg bg-space-800/60 p-3 text-sm">
              <div class="flex justify-between py-1">
                <span class="text-slate-500">文件大小等级</span>
                <span :class="shareModal.result.sizeTier === 'large' ? 'text-amber-400' : 'text-lime-400'">
                  {{ shareModal.result.sizeTier === 'large' ? '大文件（30分钟有效）' : '普通文件（15分钟有效）' }}
                </span>
              </div>
              <div class="flex justify-between py-1">
                <span class="text-slate-500">过期时间</span>
                <span class="text-slate-300">{{ shareExpireDate ? formatDate(shareExpireDate) : '' }}</span>
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-xs text-slate-400">下载链接（限时有效，过期返回 403）</label>
              <div class="flex gap-2">
                <input
                  :value="shareFullUrl"
                  readonly
                  class="input-field font-mono text-xs"
                  @focus="($event.target as HTMLInputElement).select()"
                />
                <button class="btn-primary !px-3" @click="copyShareLink">复制</button>
              </div>
            </div>
            <p class="text-xs text-slate-500">提示：链接在有效期内不限下载次数，过期后自动失效，需重新生成。</p>
          </div>
          <div class="mt-6 text-right">
            <button class="btn-secondary" @click="shareModal.visible = false">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 重命名弹窗 -->
    <Teleport to="body">
      <div v-if="renameModal.visible" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" @click.self="renameModal.visible = false">
        <div class="card w-full max-w-md p-6">
          <h3 class="mb-4 font-display text-lg font-semibold text-slate-100">重命名文件</h3>
          <input v-model="renameModal.newName" type="text" class="input-field" placeholder="输入新文件名" @keyup.enter="confirmRename" />
          <p class="mt-2 text-xs text-slate-500">系统会检测同名冲突，并同步更新底层存储。</p>
          <div class="mt-6 flex justify-end gap-2">
            <button class="btn-secondary" @click="renameModal.visible = false">取消</button>
            <button class="btn-primary" :disabled="renameModal.loading" @click="confirmRename">
              {{ renameModal.loading ? '处理中...' : '确认' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
