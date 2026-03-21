<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-button :disabled="!canSend" type="primary" @click="sendMessage">发送消息</el-button>
    </template>

    <template #toolbar>
      <el-form label-position="top" class="page-toolbar page-toolbar--composer">
        <el-form-item label="消息草稿" class="page-toolbar__field page-toolbar__field--wide page-toolbar__field--full">
          <el-input
            v-model="pageState.draft"
            clearable
            placeholder="输入实时消息，支持回车快速发送"
            @keyup.enter="sendMessage"
          />
        </el-form-item>
      </el-form>
    </template>

    <div class="split-grid">
      <SurfacePanel caption="Live Messages" title="协同频道" description="先加载 REST 历史消息，再通过 Socket.io 持续接收新消息。">
        <div v-if="messages.length" class="message-feed">
          <div v-for="message in messages" :key="message.id" class="message-row">
            <div>
              <strong>{{ message.senderName }}</strong>
              <div class="muted">{{ message.content }}</div>
              <div class="role-pill-row">
                <span v-for="role in message.senderRoles" :key="role" class="role-pill">{{ role }}</span>
              </div>
            </div>
            <small class="muted">{{ formatTime(message.createdAt) }}</small>
          </div>
        </div>
        <el-empty v-else description="暂无实时消息" />
      </SurfacePanel>

      <SurfacePanel caption="Realtime Events" title="在线事件流" description="展示在线状态、审计广播与 RBAC 结构变更的实时通知。">
        <div v-if="eventFeed.length" class="message-feed">
          <div v-for="item in eventFeed" :key="item.id" class="message-row">
            <div>
              <strong>{{ item.title }}</strong>
              <div class="muted">{{ item.body }}</div>
            </div>
            <small class="muted">{{ item.time }}</small>
          </div>
        </div>
        <el-empty v-else description="等待实时事件" />
      </SurfacePanel>
    </div>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { io, type Socket } from 'socket.io-client';
import type { LiveMessage } from '@rbac/api-common';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { usePageState } from '@/composables/use-page-state';
import { api, getStoredAccessToken, wsBaseUrl } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';

defineOptions({ name: 'LiveView' });

type FeedEvent = { id: string; title: string; body: string; time: string };

const auth = useAuthStore();
const messages = ref<LiveMessage[]>([]);
const eventFeed = ref<FeedEvent[]>([]);
const socketConnected = ref(false);
const { state: pageState } = usePageState<{ draft: string }>('page:live', { draft: '' });
const canSend = computed(() => auth.hasPermission('realtime.send'));
const stats = computed(() => [
  { label: '历史消息', value: messages.value.length },
  { label: '实时事件', value: eventFeed.value.length },
  { label: '发送权限', value: canSend.value ? '已开启' : '只读' },
  { label: '连接状态', value: socketConnected.value ? '在线' : '待连接' },
]);
let socket: Socket | null = null;

const formatTime = (value: string) => new Date(value).toLocaleTimeString();
const pushMessage = (message: LiveMessage) => {
  if (messages.value.some((item) => item.id === message.id)) {
    return;
  }
  messages.value.push(message);
};

const pushEvent = (title: string, body: string) => {
  eventFeed.value.unshift({
    id: `${Date.now()}-${Math.random()}`,
    title,
    body,
    time: new Date().toLocaleTimeString(),
  });
  eventFeed.value = eventFeed.value.slice(0, 20);
};

const sendMessage = async () => {
  if (!canSend.value || !pageState.draft.trim()) {
    return;
  }

  try {
    const created = await api.live.post(pageState.draft.trim());
    pushMessage(created);
    pageState.draft = '';
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '发送失败'));
  }
};

const connectSocket = () => {
  socket = io(wsBaseUrl, {
    auth: {
      token: getStoredAccessToken(),
    },
  });

  socket.on('connect', () => {
    socketConnected.value = true;
    pushEvent('连接建立', '已接入实时网关');
  });
  socket.on('disconnect', () => {
    socketConnected.value = false;
    pushEvent('连接断开', '实时连接已关闭');
  });
  socket.on('chat:new', (message: LiveMessage) => {
    pushMessage(message);
  });
  socket.on('presence:changed', (payload) => {
    pushEvent('在线状态', `${payload.nickname} ${payload.status}`);
  });
  socket.on('audit:event', (payload) => {
    pushEvent('审计广播', `${payload.actor} 执行了 ${payload.action} -> ${payload.target}`);
  });
  socket.on('rbac:updated', (payload) => {
    pushEvent('权限变更', payload.reason);
  });
};

onMounted(async () => {
  try {
    messages.value = await api.live.history();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载实时消息失败'));
  }
  connectSocket();
});

onUnmounted(() => {
  socket?.disconnect();
  socketConnected.value = false;
});
</script>
