<template>
  <SurfacePanel caption="权限来源" title="权限来源分析" description="查看用户当前生效的权限及角色来源。">
    <div v-if="loading" class="surface-panel__placeholder">
      <el-skeleton :rows="6" animated />
    </div>

    <div v-else-if="source" class="panel-grid">
      <section class="detail-section">
        <div class="detail-section__header">
          <div class="detail-user">
            <UserAvatar :avatar-url="source.user.avatarUrl" :name="source.user.nickname" size="lg" />
            <div class="detail-user__meta">
              <p class="panel-caption">当前用户</p>
              <h3 class="panel-heading panel-heading--lg">{{ source.user.nickname }}</h3>
              <p class="muted">{{ source.user.email || '未设置邮箱' }}</p>
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

      <div class="dual-grid">
        <article v-for="group in source.groups" :key="group.role.id" class="permission-cluster">
          <header>
            <div>
              <strong>{{ group.role.name }}</strong>
              <div class="muted">{{ group.role.description || '该角色未填写描述。' }}</div>
            </div>
            <span class="role-pill">{{ group.permissions.length }} 项</span>
          </header>
          <div class="tag-list">
            <span v-for="permission in group.permissions" :key="permission.id" class="permission-tag">
              {{ permission.code }}
            </span>
          </div>
        </article>
      </div>
    </div>

    <el-empty v-else description="请选择一个用户查看权限来源" />
  </SurfacePanel>
</template>

<script setup lang="ts">
import type { UserPermissionSource } from '@rbac/api-common';
import UserAvatar from '@/components/common/UserAvatar.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';

defineProps<{
  loading: boolean;
  source: UserPermissionSource | null;
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
