import 'element-plus/dist/index.css';
import './styles/main.css';

import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { elementPlusPlugin } from './plugins/element-plus';
import { router } from './router';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(elementPlusPlugin);
app.mount('#app');
