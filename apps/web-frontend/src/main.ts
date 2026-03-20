import { createApp } from 'vue';
import 'element-plus/es/components/loading/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import App from './App.vue';
import { pinia } from './stores';
import { router } from './router';
import './styles/main.scss';

createApp(App).use(pinia).use(router).mount('#app');
