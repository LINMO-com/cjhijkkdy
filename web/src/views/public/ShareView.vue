<script setup lang="ts">
/**
 * 公开网页 - 分享下载页
 * ----------------------------------------------------------------------------
 * 访客通过分享链接访问此页（路由 /s/:shareToken）
 * - 展示剩余有效时间倒计时
 * - 点击下载按钮触发限时下载（后端校验签名与过期）
 * - 过期后按钮禁用，提示链接已失效
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { shareApi } from '@/api';
import { useToast } from '@/composables/useToast';
import { formatCountdown } from '@/utils/format';

const route = useRoute();
const toast = useToast();

const shareToken = route.params.shareToken as string;
const downloadUrl = computed(() => shareApi.downloadUrl(shareToken));

// 倒计时状态
const remainingMs = ref<number>(0);
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * 解析分享令牌中的过期时间
 * 令牌格式：base64url(payload).base64url(signature)
 * payload = { fileId, expireAt, sizeTier, nonce }
 */
function parseExpireAt(): number {
  try {
    const payloadStr = shareToken.split('.')[0];
    // base64url 解码
    const json = atob(payloadStr.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { expireAt: number };
    return payload.expireAt;
  } catch {
    return 0; // 解析失败视为已过期
  }
}

const expireAt = parseExpireAt();
const isExpired = computed(() => remainingMs.value <= 0);

/** 更新倒计时 */
function updateCountdown(): void {
  remainingMs.value = expireAt - Date.now();
  if (remainingMs.value <= 0 && timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** 触发下载 */
function onDownload(): void {
  if (isExpired.value) {
    toast.error('分享链接已过期');
    return;
  }
  // 直接跳转下载 URL，浏览器会触发文件下载
  window.location.href = downloadUrl.value;
}

onMounted(() => {
  updateCountdown();
  if (!isExpired.value) {
    timer = setInterval(updateCountdown, 1000);
  }
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-space-900 px-4">
    <!-- 背景装饰 -->
    <div class="pointer-events-none fixed inset-0 overflow-hidden">
      <div class="absolute left-1/3 top-0 h-96 w-96 rounded-full bg-lime-400/10 blur-3xl"></div>
      <div class="absolute right-1/3 bottom-0 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl"></div>
    </div>

    <div class="card relative z-10 w-full max-w-md p-8 text-center">
      <!-- 图标 -->
      <div
        :class="[
          'mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full',
          isExpired ? 'bg-red-500/10 text-red-400' : 'bg-lime-400/10 text-lime-400',
        ]"
      >
        <svg v-if="!isExpired" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6m0-6l-6 6" stroke-linecap="round" />
        </svg>
      </div>

      <h1 class="font-display text-xl font-bold text-slate-100">
        {{ isExpired ? '链接已失效' : '安全文件下载' }}
      </h1>

      <!-- 有效状态 -->
      <div v-if="!isExpired" class="mt-4 space-y-3">
        <p class="text-sm text-slate-400">该链接由管理员生成，请在有效期内下载。</p>
        <div class="rounded-lg bg-space-800/60 p-4">
          <p class="text-xs text-slate-500">剩余有效时间</p>
          <p class="mt-1 font-mono text-2xl font-bold text-lime-400">{{ formatCountdown(remainingMs) }}</p>
        </div>
        <button class="btn-primary w-full" @click="onDownload">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          下载文件
        </button>
        <p class="text-xs text-slate-600">有效期内不限下载次数，过期后链接自动失效（返回 403）。</p>
      </div>

      <!-- 过期状态 -->
      <div v-else class="mt-4 space-y-3">
        <p class="text-sm text-slate-400">抱歉，此分享链接已过期或无效。</p>
        <p class="text-xs text-slate-600">请联系文件管理员重新生成分享链接。</p>
        <router-link to="/" class="btn-secondary inline-block">返回首页</router-link>
      </div>
    </div>
  </div>
</template>
