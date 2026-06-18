/**
 * 管理员状态管理（Pinia）
 * ----------------------------------------------------------------------------
 * 管理登录态、token 持久化
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api';

export const useAdminStore = defineStore('admin', () => {
  // 从 localStorage 恢复 token
  const token = ref<string>(localStorage.getItem('admin_token') || '');
  const username = ref<string>(localStorage.getItem('admin_username') || '');

  /** 是否已登录 */
  const isLoggedIn = computed(() => !!token.value);

  /**
   * 登录
   */
  async function login(user: string, password: string): Promise<void> {
    const result = await authApi.login(user, password);
    token.value = result.token;
    username.value = result.admin.username;
    localStorage.setItem('admin_token', result.token);
    localStorage.setItem('admin_username', result.admin.username);
  }

  /**
   * 登出
   */
  function logout(): void {
    token.value = '';
    username.value = '';
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
  }

  return { token, username, isLoggedIn, login, logout };
});
