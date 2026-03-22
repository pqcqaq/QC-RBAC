import { createApp } from 'vue';
import 'element-plus/es/components/loading/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import App from './App.vue';
import { registerAccessDirectives } from './directives/access';
import { pinia } from './stores';
import { router } from './router';
import { beginBootProgress, markAppReady } from './utils/app-progress';
import './styles/main.scss';

beginBootProgress();

const app = createApp(App);

registerAccessDirectives(app);

app.use(pinia).use(router).mount('#app');

void router.isReady().finally(() => {
  window.requestAnimationFrame(() => {
    markAppReady();
  });
});
