<template>
  <el-drawer
    :model-value="visible"
    :title="user ? `${user.nickname} · 用户详情` : '用户详情'"
    size="38%"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="user" class="detail-stack">
      <section class="detail-section">
        <div class="detail-section__header">
          <div class="detail-user">
            <UserAvatar :avatar-url="user.avatarUrl" :name="user.nickname" size="lg" />
            <div class="detail-user__meta">
              <p class="panel-caption">Profile</p>
              <h3 class="panel-heading panel-heading--md">{{ user.nickname }}</h3>
              <p class="muted">{{ user.email || user.username }}</p>
            </div>
          </div>
          <el-tag :type="user.status === 'ACTIVE' ? 'success' : 'info'" round>
            {{ user.status === 'ACTIVE' ? '启用' : '禁用' }}
          </el-tag>
        </div>

        <div class="detail-kv-grid">
          <div class="detail-kv">
            <span>用户名</span>
            <strong>{{ user.username }}</strong>
          </div>
          <div class="detail-kv">
            <span>邮箱</span>
            <strong>{{ user.email || '未设置邮箱' }}</strong>
          </div>
          <div class="detail-kv">
            <span>创建时间</span>
            <strong>{{ formatTime(user.createdAt) }}</strong>
          </div>
          <div class="detail-kv">
            <span>更新时间</span>
            <strong>{{ formatTime(user.updatedAt) }}</strong>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Assigned Roles</p>
            <h3 class="panel-heading panel-heading--md">角色绑定</h3>
          </div>
          <el-tag type="info" round>{{ user.roles.length }} 个角色</el-tag>
        </div>
        <div class="detail-chip-list">
          <span v-for="role in user.roles" :key="role.id" class="role-pill">{{ role.name }}</span>
        </div>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { UserRecord } from '@rbac/api-common';
import UserAvatar from '@/components/common/UserAvatar.vue';

defineProps<{
  visible: boolean;
  user: UserRecord | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
</script>

<style scoped lang="scss">
.detail-user {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.detail-user__meta {
  display: grid;
  gap: 4px;
  min-width: 0;
}
</style>
