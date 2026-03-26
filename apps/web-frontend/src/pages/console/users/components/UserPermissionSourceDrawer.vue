<template>
  <el-drawer
    :model-value="visible"
    :title="source ? `${source.user.nickname} · 权限来源` : '权限来源'"
    size="42%"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="source" class="detail-stack">
      <section class="detail-section">
        <div class="detail-section__header">
          <div class="detail-user">
            <UserAvatar :avatar-url="source.user.avatarUrl" :name="source.user.nickname" size="lg" />
            <div class="detail-user__meta">
              <p class="panel-caption">Effective Permissions</p>
              <h3 class="panel-heading panel-heading--md">{{ source.user.nickname }}</h3>
              <p class="muted">{{ source.user.email || source.user.username }}</p>
            </div>
          </div>
          <el-tag round>{{ source.effectivePermissions.length }} 项权限</el-tag>
        </div>
        <div class="detail-chip-list">
          <span v-for="permission in source.effectivePermissions" :key="permission.id" class="permission-tag">
            {{ permission.code }}
          </span>
        </div>
      </section>

      <section v-for="group in source.groups" :key="group.role.id" class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Role Source</p>
            <h3 class="panel-heading panel-heading--md">{{ group.role.name }}</h3>
            <p class="muted">{{ group.role.description || '该角色未填写描述。' }}</p>
          </div>
          <el-tag type="info" round>{{ group.permissions.length }} 项来源</el-tag>
        </div>
        <div class="detail-chip-list">
          <span v-for="permission in group.permissions" :key="permission.id" class="permission-tag">
            {{ permission.code }}
          </span>
        </div>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { UserPermissionSource } from '@rbac/api-common';
import UserAvatar from '@/components/common/UserAvatar.vue';

defineProps<{
  visible: boolean;
  source: UserPermissionSource | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();
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
