/**
 * 前端入口
 * ----------------------------------------------------------------------------
 * 创建 Vue 应用，注册路由与 Pinia
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
