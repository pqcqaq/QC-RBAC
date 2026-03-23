<template>
  <el-dialog
    :model-value="visible"
    title="删除菜单节点"
    width="520px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="node" class="menu-delete-dialog">
      <div class="menu-delete-dialog__hero">
        <span class="menu-delete-dialog__icon">
          <UnoIcon :name="resolveMenuNodeIcon(node)" :title="node.title" :size="24" />
        </span>

        <div class="menu-delete-dialog__copy">
          <strong>{{ node.title }}</strong>
          <span>{{ resolveTypeLabel(node.type) }} · {{ node.code }}</span>
        </div>
      </div>

      <p class="menu-delete-dialog__warning">
        {{ descendantCount
          ? `该节点下还有 ${descendantCount} 个子节点，确认后会一并删除。`
          : '删除后不可恢复，请确认这是你期望的操作。' }}
      </p>

      <div class="menu-delete-dialog__facts">
        <article class="menu-delete-dialog__fact">
          <span>页面路径</span>
          <strong>{{ node.path || '不适用' }}</strong>
        </article>
        <article class="menu-delete-dialog__fact">
          <span>权限绑定</span>
          <strong>{{ resolvePermissionSummary(node) }}</strong>
        </article>
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="danger" :loading="deleting" :disabled="!node" @click="emit('confirm')">确认删除</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { MenuNodeRecord } from '@rbac/api-common';
import UnoIcon from '@/components/common/UnoIcon.vue';
import { resolveMenuNodeIcon } from '@/components/common/uno-icons';
import { resolvePermissionSummary, resolveTypeLabel } from '../menu-management';

defineProps<{
  visible: boolean;
  deleting: boolean;
  node: MenuNodeRecord | null;
  descendantCount: number;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  confirm: [];
}>();
</script>

<style scoped lang="scss">
.menu-delete-dialog {
  display: grid;
  gap: 16px;
}

.menu-delete-dialog__hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--danger) 24%, var(--line-soft));
  border-radius: 18px;
  background: var(--surface-danger-subtle);
}

.menu-delete-dialog__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: var(--surface-accent-subtle);
  color: var(--accent-strong);
}

.menu-delete-dialog__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.menu-delete-dialog__copy strong {
  color: var(--ink-1);
  font-size: 15px;
}

.menu-delete-dialog__copy span {
  color: var(--ink-3);
  font-size: 12px;
}

.menu-delete-dialog__warning {
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.7;
}

.menu-delete-dialog__facts {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.menu-delete-dialog__fact {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: var(--surface-card-bg);
}

.menu-delete-dialog__fact span {
  color: var(--ink-3);
  font-size: 12px;
}

.menu-delete-dialog__fact strong {
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

@media (max-width: 860px) {
  .menu-delete-dialog__hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .menu-delete-dialog__facts {
    grid-template-columns: 1fr;
  }
}
</style>
