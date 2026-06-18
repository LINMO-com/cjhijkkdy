<script setup lang="ts">
/**
 * 管理后台 - 上传页
 * ----------------------------------------------------------------------------
 * 拖拽上传 + 元数据填写（标题/描述/分类/标签）
 * 上传成功后跳转文件列表
 */
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { adminFileApi } from '@/api';
import { useToast } from '@/composables/useToast';
import UploadArea from '@/components/UploadArea.vue';

const router = useRouter();
const toast = useToast();

const files = ref<File[]>([]);
const loading = ref(false);

// 元数据
const meta = reactive({
  title: '',
  description: '',
  category: 'uncategorized',
  tagsText: '',
});

/** 处理上传 */
async function onUpload(selectedFiles: File[]): Promise<void> {
  if (selectedFiles.length === 0) {
    toast.error('请先选择文件');
    return;
  }
  loading.value = true;
  try {
    const tags = meta.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    await adminFileApi.upload(selectedFiles, {
      title: meta.title || undefined,
      description: meta.description || undefined,
      category: meta.category || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
    toast.success(`成功上传 ${selectedFiles.length} 个文件`);
    files.value = [];
    router.push('/admin/files');
  } catch (err) {
    toast.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-space-900">
    <header class="sticky top-0 z-20 border-b border-space-600 bg-space-800/80 backdrop-blur">
      <div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <button class="text-sm text-slate-400 transition hover:text-lime-400" @click="router.push('/admin/files')">← 返回列表</button>
        <span class="font-display text-sm font-semibold text-slate-200">上传文件</span>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-6 py-8">
      <div class="grid gap-6 md:grid-cols-2">
        <!-- 左：上传区 -->
        <div class="space-y-4">
          <h2 class="font-display text-base font-semibold text-slate-200">选择文件</h2>
          <UploadArea v-model="files" :loading="loading" @upload="onUpload" />
        </div>

        <!-- 右：元数据 -->
        <div class="space-y-4">
          <h2 class="font-display text-base font-semibold text-slate-200">文件信息（可选）</h2>
          <div class="card space-y-4 p-5">
            <div>
              <label class="mb-1.5 block text-xs text-slate-400">标题</label>
              <input v-model="meta.title" type="text" class="input-field" placeholder="留空则使用文件名" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs text-slate-400">描述</label>
              <textarea v-model="meta.description" class="input-field min-h-[80px] resize-y" placeholder="文件描述"></textarea>
            </div>
            <div>
              <label class="mb-1.5 block text-xs text-slate-400">分类</label>
              <input v-model="meta.category" type="text" class="input-field" placeholder="如：报告、合同、图片" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs text-slate-400">标签（逗号分隔）</label>
              <input v-model="meta.tagsText" type="text" class="input-field" placeholder="如：2026,财报,Q1" />
            </div>
            <p class="text-xs text-slate-500">元数据将应用到本次上传的所有文件，可在上传后单独编辑。</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
