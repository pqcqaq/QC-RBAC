<template>
  <el-form label-position="top" class="page-toolbar">
    <el-form-item label="目标用户" class="page-toolbar__field page-toolbar__field--wide">
      <el-select
        :model-value="selectedUserId"
        filterable
        remote
        reserve-keyword
        clearable
        :loading="loading"
        placeholder="输入昵称 / 邮箱搜索用户"
        :remote-method="handleSearch"
        @update:model-value="handleChange"
      >
        <el-option
          v-for="user in userOptions"
          :key="user.id"
          :label="resolveUserLabel(user)"
          :value="user.id"
        >
          <div class="explorer-user-option">
            <UserAvatar :avatar-url="user.avatarUrl" :name="user.nickname" size="sm" />
            <div class="explorer-user-option__meta">
              <strong>{{ user.nickname }}</strong>
              <span>{{ user.email || '未设置邮箱' }}</span>
            </div>
          </div>
        </el-option>

        <template #footer>
          <div class="explorer-select-footer">
            <span>{{ total }} 位用户 · 第 {{ page }} / {{ totalPages }} 页</span>
            <el-space>
              <el-button link :disabled="page <= 1" @click="emit('page-change', page - 1)">上一页</el-button>
              <el-button link :disabled="page >= totalPages" @click="emit('page-change', page + 1)">下一页</el-button>
            </el-space>
          </div>
        </template>
      </el-select>
    </el-form-item>

    <div class="page-toolbar__actions">
      <el-button @click="emit('refresh-users')">刷新用户</el-button>
      <el-button type="primary" plain :disabled="!selectedUserId" @click="emit('reload-source')">
        重新分析
      </el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { UserRecord } from '@rbac/api-common';
import UserAvatar from '@/components/common/UserAvatar.vue';

const props = defineProps<{
  selectedUserId: string;
  userOptions: UserRecord[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
}>();

const emit = defineEmits<{
  change: [id?: string];
  'refresh-users': [];
  'reload-source': [];
  search: [keyword: string];
  'page-change': [value: number];
}>();

const totalPages = computed(() => Math.max(Math.ceil(props.total / props.pageSize), 1));

const handleChange = (value: string | undefined) => {
  emit('change', value);
};

const handleSearch = (value: string) => {
  emit('search', value);
};

const resolveUserLabel = (user: UserRecord) => `${user.nickname} (${user.email || '未设置邮箱'})`;
</script>

<style scoped lang="scss">
.explorer-user-option {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.explorer-user-option__meta {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.explorer-user-option__meta strong {
  font-size: 13px;
}

.explorer-user-option__meta span {
  color: var(--ink-3);
  font-size: 12px;
}

.explorer-select-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
}
</style>
