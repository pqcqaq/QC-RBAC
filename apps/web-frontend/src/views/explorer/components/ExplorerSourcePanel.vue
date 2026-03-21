<template>
  <SurfacePanel caption="Traceability" title="权限来源分析" description="按用户拆解实际生效权限，直接看到每个权限是通过哪个角色继承而来。">
    <div v-if="loading" class="surface-panel__placeholder">
      <el-skeleton :rows="6" animated />
    </div>

    <div v-else-if="source" class="panel-grid">
      <section class="detail-section">
        <div class="detail-section__header">
          <div>
            <p class="panel-caption">Effective Set</p>
            <h3 class="panel-heading panel-heading--lg">{{ source.user.nickname }}</h3>
            <p class="muted">{{ source.user.email }}</p>
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
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';

defineProps<{
  loading: boolean;
  source: UserPermissionSource | null;
}>();
</script>
