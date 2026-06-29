import 'element-plus/dist/index.css';
import './styles/main.css';

import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { elementPlusPlugin } from './plugins/element-plus';
import { router } from './router';
import { setAppRuntimeError } from './runtime/appRuntimeError';

const app = createApp(App);

app.config.errorHandler = () => {
  setAppRuntimeError('vue');
};

window.addEventListener('error', () => {
  setAppRuntimeError('window');
});

window.addEventListener('unhandledrejection', () => {
  setAppRuntimeError('promise');
});

app.use(createPinia());
app.use(router);
app.use(elementPlusPlugin);
app.mount('#app');
