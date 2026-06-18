/**
 * 路由配置
 * ----------------------------------------------------------------------------
 * 公开网页与管理后台共用一套 SPA，通过路由区分
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAdminStore } from '@/stores/admin';

const routes: RouteRecordRaw[] = [
  // ---- 公开网页 ----
  {
    path: '/',
    name: 'public-home',
    component: () => import('@/views/public/HomeView.vue'),
  },
  {
    path: '/preview/:fileId',
    name: 'public-preview',
    component: () => import('@/views/public/PreviewView.vue'),
  },
  {
    path: '/s/:shareToken',
    name: 'public-share',
    component: () => import('@/views/public/ShareView.vue'),
  },

  // ---- 管理后台 ----
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/admin/LoginView.vue'),
  },
  {
    path: '/admin/files',
    name: 'admin-files',
    component: () => import('@/views/admin/FileListView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/upload',
    name: 'admin-upload',
    component: () => import('@/views/admin/UploadView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/edit/:fileId',
    name: 'admin-edit',
    component: () => import('@/views/admin/EditView.vue'),
    meta: { requiresAuth: true },
  },

  // 兜底重定向
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

/**
 * 全局前置守卫：管理后台路由鉴权
 */
router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAuth) {
    const store = useAdminStore();
    if (!store.isLoggedIn) {
      next({ name: 'admin-login', query: { redirect: to.fullPath } });
      return;
    }
  }
  next();
});

export default router;
