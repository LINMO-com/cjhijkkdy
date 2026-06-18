<script setup lang="ts">
/**
 * 根组件
 * 仅作为路由出口容器，挂载全局 Toast 通知
 */
import ToastContainer from '@/components/ToastContainer.vue';
</script>

<template>
  <router-view />
  <ToastContainer />
</template>
