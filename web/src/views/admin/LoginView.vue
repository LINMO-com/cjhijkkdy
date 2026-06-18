<script setup lang="ts">
/**
 * 管理后台 - 登录页
 * ----------------------------------------------------------------------------
 * 管理员账号密码登录，成功后跳转文件列表
 */
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAdminStore } from '@/stores/admin';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const route = useRoute();
const store = useAdminStore();
const toast = useToast();

const form = reactive({ username: '', password: '' });
const loading = ref(false);

/** 提交登录 */
async function onSubmit(): Promise<void> {
  if (!form.username || !form.password) {
    toast.error('请输入用户名和密码');
    return;
  }
  loading.value = true;
  try {
    await store.login(form.username, form.password);
    toast.success('登录成功');
    const redirect = (route.query.redirect as string) || '/admin/files';
    router.replace(redirect);
  } catch (err) {
    toast.error((err as Error).message);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-space-900 px-4">
    <!-- 背景装饰：渐变光晕 -->
    <div class="pointer-events-none fixed inset-0 overflow-hidden">
      <div class="absolute -left-40 top-0 h-96 w-96 rounded-full bg-lime-400/10 blur-3xl"></div>
      <div class="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl"></div>
    </div>

    <div class="card relative z-10 w-full max-w-md p-8">
      <div class="mb-8 text-center">
        <h1 class="font-display text-2xl font-bold text-slate-100">文档管理系统</h1>
        <p class="mt-2 text-sm text-slate-500">管理后台登录</p>
      </div>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div>
          <label class="mb-1.5 block text-xs text-slate-400">用户名</label>
          <input v-model="form.username" type="text" class="input-field" placeholder="请输入用户名" autocomplete="username" />
        </div>
        <div>
          <label class="mb-1.5 block text-xs text-slate-400">密码</label>
          <input v-model="form.password" type="password" class="input-field" placeholder="请输入密码" autocomplete="current-password" />
        </div>
        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? '登录中...' : '登 录' }}
        </button>
      </form>

      <p class="mt-6 text-center text-xs text-slate-600">默认账号: admin / admin123</p>
      <p class="mt-2 text-center">
        <router-link to="/" class="text-xs text-slate-500 transition hover:text-lime-400">← 返回公开首页</router-link>
      </p>
    </div>
  </div>
</template>
