<script setup lang="ts">
/**
 * 管理后台 - 元数据编辑页
 * ----------------------------------------------------------------------------
 * 编辑文件标题、描述、分类、标签、公开状态
 */
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { adminFileApi } from '@/api';
import { useToast } from '@/composables/useToast';
import { formatSize, formatDate } from '@/utils/format';
import FileIcon from '@/components/FileIcon.vue';
import type { FileDTO } from '@/types';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const fileId = route.params.fileId as string;
const file = ref<FileDTO | null>(null);
const loading = ref(false);
const saving = ref(false);

const form = reactive({
  title: '',
  description: '',
  category: '',
  tagsText: '',
  isPublic: true,
});

/** 加载文件详情 */
async function loadFile(): Promise<void> {
  loading.value = true;
  try {
    const found = await adminFileApi.getById(fileId);
    if (!found) throw new Error('文件不存在');
    file.value = found;
    form.title = found.title;
    form.description = found.description || '';
    form.category = found.category;
    form.tagsText = (found.tags || []).join(', ');
    form.isPublic = found.isPublic;
  } catch (err) {
    toast.error((err as Error).message);
    router.replace('/admin/files');
  } finally {
    loading.value = false;
  }
}

/** 保存 */
async function onSave(): Promise<void> {
  saving.value = true;
  try {
    const tags = form.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    await adminFileApi.update(fileId, {
      title: form.title,
      description: form.description,
      category: form.category,
      tags,
      isPublic: form.isPublic,
    });
    toast.success('保存成功');
    router.push('/admin/files');
  } catch (err) {
    toast.error((err as Error).message);
  } finally {
    saving.value = false;
  }
}

onMounted(loadFile);
</script>

<template>
  <div class="min-h-screen bg-space-900">
    <header class="sticky top-0 z-20 border-b border-space-600 bg-space-800/80 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <button class="text-sm text-slate-400 transition hover:text-lime-400" @click="router.push('/admin/files')">← 返回列表</button>
        <span class="font-display text-sm font-semibold text-slate-200">编辑文件</span>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-8">
      <div v-if="loading" class="space-y-3">
        <div class="h-20 animate-pulse rounded-lg bg-space-700/50"></div>
        <div class="h-64 animate-pulse rounded-lg bg-space-700/50"></div>
      </div>

      <div v-else-if="file" class="space-y-6">
        <!-- 文件信息卡 -->
        <div class="card flex items-center gap-4 p-5">
          <FileIcon :ext="file.ext" size="lg" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-slate-200">{{ file.originalName }}</p>
            <div class="mt-1 flex gap-4 text-xs text-slate-500">
              <span>{{ formatSize(file.size) }}</span>
              <span>{{ file.mimeType }}</span>
              <span>{{ formatDate(file.createdAt) }}</span>
            </div>
          </div>
        </div>

        <!-- 编辑表单 -->
        <div class="card space-y-4 p-5">
          <div>
            <label class="mb-1.5 block text-xs text-slate-400">标题</label>
            <input v-model="form.title" type="text" class="input-field" />
          </div>
          <div>
            <label class="mb-1.5 block text-xs text-slate-400">描述</label>
            <textarea v-model="form.description" class="input-field min-h-[100px] resize-y"></textarea>
          </div>
          <div>
            <label class="mb-1.5 block text-xs text-slate-400">分类</label>
            <input v-model="form.category" type="text" class="input-field" />
          </div>
          <div>
            <label class="mb-1.5 block text-xs text-slate-400">标签（逗号分隔）</label>
            <input v-model="form.tagsText" type="text" class="input-field" />
          </div>
          <div class="flex items-center gap-2">
            <input v-model="form.isPublic" type="checkbox" id="isPublic" class="h-4 w-4 accent-lime-400" />
            <label for="isPublic" class="text-sm text-slate-300">公开显示在网页前端</label>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button class="btn-secondary" @click="router.push('/admin/files')">取消</button>
            <button class="btn-primary" :disabled="saving" @click="onSave">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
