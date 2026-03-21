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
          <div>
            <p class="panel-caption">Effective Permissions</p>
            <h3 class="panel-heading panel-heading--md">{{ source.user.nickname }}</h3>
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

defineProps<{
  visible: boolean;
  source: UserPermissionSource | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();
</script>
