<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-button v-permission="'realtime.send'" type="primary" @click="sendMessage">发送消息</el-button>
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
      <SurfacePanel caption="Live Messages" title="协同频道" description="历史消息走分页接口，第一页持续接入实时新消息。">
        <div v-loading="historyLoading">
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
        </div>

        <el-pagination
          v-if="totalHistory > historyPageSize"
          background
          layout="prev, pager, next, total"
          :current-page="pageState.historyPage"
          :page-size="historyPageSize"
          :total="totalHistory"
          @current-change="changeHistoryPage"
        />
      </SurfacePanel>

      <SurfacePanel caption="Realtime Events" title="在线事件流" description="当前会话内的实时通知，前端按页查看最新事件。">
        <div v-if="pagedEventFeed.length" class="message-feed">
          <div v-for="item in pagedEventFeed" :key="item.id" class="message-row">
            <div>
              <strong>{{ item.title }}</strong>
              <div class="muted">{{ item.body }}</div>
            </div>
            <small class="muted">{{ item.time }}</small>
          </div>
        </div>
        <el-empty v-else description="等待实时事件" />

        <el-pagination
          v-if="eventFeed.length > eventPageSize"
          background
          layout="prev, pager, next, total"
          :current-page="pageState.eventPage"
          :page-size="eventPageSize"
          :total="eventFeed.length"
          @current-change="changeEventPage"
        />
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

definePage({
  viewKey: 'live',
  keepAlive: true,
});

type FeedEvent = { id: string; title: string; body: string; time: string };
type LivePageState = { draft: string; historyPage: number; eventPage: number };

const historyPageSize = 10;
const eventPageSize = 8;
const auth = useAuthStore();
const messages = ref<LiveMessage[]>([]);
const eventFeed = ref<FeedEvent[]>([]);
const socketConnected = ref(false);
const historyLoading = ref(false);
const totalHistory = ref(0);
const knownMessageIds = new Set<string>();
const { state: pageState } = usePageState<LivePageState>('page:live', {
  draft: '',
  historyPage: 1,
  eventPage: 1,
});
const canSend = computed(() => auth.hasPermission('realtime.send'));
const pagedEventFeed = computed(() => {
  const start = (pageState.eventPage - 1) * eventPageSize;
  return eventFeed.value.slice(start, start + eventPageSize);
});
const stats = computed(() => [
  { label: '历史消息', value: totalHistory.value },
  { label: '当前页消息', value: messages.value.length },
  { label: '实时事件', value: eventFeed.value.length },
  { label: '连接状态', value: socketConnected.value ? '在线' : '待连接' },
]);
let socket: Socket | null = null;

const formatTime = (value: string) => new Date(value).toLocaleTimeString();

const rememberMessages = (items: LiveMessage[]) => {
  items.forEach((item) => {
    knownMessageIds.add(item.id);
  });
};

const pushMessage = (message: LiveMessage) => {
  if (knownMessageIds.has(message.id)) {
    return;
  }

  knownMessageIds.add(message.id);
  totalHistory.value += 1;

  if (pageState.historyPage !== 1) {
    return;
  }

  messages.value = [...messages.value, message].slice(-historyPageSize);
};

const pushEvent = (title: string, body: string) => {
  eventFeed.value.unshift({
    id: `${Date.now()}-${Math.random()}`,
    title,
    body,
    time: new Date().toLocaleTimeString(),
  });
  eventFeed.value = eventFeed.value.slice(0, 50);

  const totalPages = Math.max(Math.ceil(eventFeed.value.length / eventPageSize), 1);
  if (pageState.eventPage > totalPages) {
    pageState.eventPage = totalPages;
  }
};

const loadHistory = async () => {
  try {
    historyLoading.value = true;
    const response = await api.live.history({
      page: pageState.historyPage,
      pageSize: historyPageSize,
    });
    messages.value = response.items;
    totalHistory.value = response.meta.total;
    rememberMessages(response.items);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载实时消息失败'));
  } finally {
    historyLoading.value = false;
  }
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

const changeHistoryPage = async (value: number) => {
  pageState.historyPage = value;
  await loadHistory();
};

const changeEventPage = (value: number) => {
  pageState.eventPage = value;
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
  await loadHistory();
  connectSocket();
});

onUnmounted(() => {
  socket?.disconnect();
  socketConnected.value = false;
});
</script>
