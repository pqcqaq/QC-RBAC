<template>
  <SurfacePanel
    caption="Inspector"
    :title="selectedNode ? selectedNode.title : '选择一个节点'"
    :description="selectedNode ? description : '从左侧选择一个节点，右侧查看结构信息并发起新增、编辑、删除。'"
  >
    <template v-if="selectedNode" #actions>
      <el-space wrap>
        <el-button plain :disabled="!canUpdate" @click="emit('edit')">编辑</el-button>
        <el-button plain :disabled="!canCreate" @click="emit('create-sibling')">新增同级</el-button>
        <el-button plain type="primary" :disabled="!canCreate || selectedNode.type === 'ACTION'" @click="emit('create-child')">
          新增子级
        </el-button>
        <el-button plain type="danger" :disabled="!canDelete" @click="emit('delete')">删除</el-button>
      </el-space>
    </template>

    <div v-if="selectedNode" class="menu-inspector">
      <section class="menu-inspector__hero">
        <span class="menu-inspector__icon">
          <UnoIcon :name="resolveMenuNodeIcon(selectedNode)" :title="selectedNode.title" :size="28" />
        </span>

        <div class="menu-inspector__hero-copy">
          <div class="menu-inspector__eyebrow">
            <p class="panel-caption">{{ resolveTypeLabel(selectedNode.type) }} Node</p>
            <span class="menu-tree-node__type" :class="`is-${selectedNode.type.toLowerCase()}`">
              {{ resolveTypeLabel(selectedNode.type) }}
            </span>
          </div>

          <h3>{{ selectedNode.title }}</h3>
          <p class="menu-inspector__subtitle">{{ resolveNodeSubtitle(selectedNode) }}</p>
        </div>
      </section>

      <div class="menu-inspector__stats">
        <article class="menu-inspector__stat">
          <span>子节点</span>
          <strong>{{ selectedNode.children.length }}</strong>
        </article>
        <article class="menu-inspector__stat">
          <span>排序值</span>
          <strong>{{ selectedNode.sortOrder }}</strong>
        </article>
        <article class="menu-inspector__stat">
          <span>更新时间</span>
          <strong>{{ formatTime(selectedNode.updatedAt) }}</strong>
        </article>
      </div>

      <div class="menu-inspector__grid">
        <article class="menu-inspector__kv">
          <span>节点编码</span>
          <strong>{{ selectedNode.code }}</strong>
        </article>
        <article class="menu-inspector__kv">
          <span>父节点</span>
          <strong>{{ selectedParentNode?.title ?? '根节点' }}</strong>
        </article>
        <article class="menu-inspector__kv">
          <span>页面路径</span>
          <strong>{{ selectedNode.path || '不适用' }}</strong>
        </article>
        <article class="menu-inspector__kv">
          <span>页面视图</span>
          <strong>{{ selectedNode.viewKey || '不适用' }}</strong>
        </article>
        <article class="menu-inspector__kv">
          <span>权限绑定</span>
          <strong>{{ resolvePermissionSummary(selectedNode) }}</strong>
        </article>
        <article class="menu-inspector__kv">
          <span>图标</span>
          <strong>{{ selectedNode.icon || resolveMenuNodeIcon(selectedNode) }}</strong>
        </article>
        <article class="menu-inspector__kv menu-inspector__kv--full">
          <span>描述</span>
          <strong>{{ selectedNode.description || '该节点未填写描述。' }}</strong>
        </article>
      </div>

      <div class="menu-editor__hint">
        <strong>结构约束</strong>
        <span>{{ resolveStructureHint(selectedNode.type) }}</span>
      </div>
    </div>

    <el-empty v-else description="先从左侧选择一个节点，再进行结构维护。" />
  </SurfacePanel>
</template>

<script setup lang="ts">
import type { MenuNodeRecord } from '@rbac/api-common';
import UnoIcon from '@/components/common/UnoIcon.vue';
import { resolveMenuNodeIcon } from '@/components/common/uno-icons';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { resolveNodeSubtitle, resolvePermissionSummary, resolveStructureHint, resolveTypeLabel } from '../menu-management';

defineProps<{
  selectedNode: MenuNodeRecord | null;
  selectedParentNode: MenuNodeRecord | null;
  description: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  'create-sibling': [];
  'create-child': [];
  delete: [];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();
</script>

<style scoped lang="scss">
.menu-tree-node__type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.menu-tree-node__type.is-directory {
  background: color-mix(in srgb, var(--accent) 16%, white);
  color: color-mix(in srgb, var(--accent) 82%, #143255);
}

.menu-tree-node__type.is-page {
  background: color-mix(in srgb, #0f9d80 14%, white);
  color: #0d6e5c;
}

.menu-tree-node__type.is-action {
  background: color-mix(in srgb, #ff9a1f 18%, white);
  color: #9a5a00;
}

.menu-inspector {
  display: grid;
  gap: 18px;
}

.menu-inspector__hero {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--line-soft);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 251, 254, 0.88) 100%);
}

.menu-inspector__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent) 12%, white);
  color: color-mix(in srgb, var(--accent) 76%, #143255);
}

.menu-inspector__hero-copy {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.menu-inspector__hero-copy h3 {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.15;
}

.menu-inspector__eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.menu-inspector__subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--ink-2);
  line-height: 1.55;
}

.menu-inspector__stats {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.menu-inspector__stat,
.menu-inspector__kv {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: color-mix(in srgb, white 94%, var(--surface-2));
}

.menu-inspector__stat span,
.menu-inspector__kv span {
  color: var(--ink-3);
  font-size: 12px;
}

.menu-inspector__stat strong,
.menu-inspector__kv strong {
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.menu-inspector__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.menu-inspector__kv--full {
  grid-column: 1 / -1;
}

.menu-editor__hint {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px dashed var(--line-strong);
  border-radius: 16px;
  background: color-mix(in srgb, white 84%, var(--surface-2));
  color: var(--ink-2);
}

.menu-editor__hint strong {
  color: var(--ink-1);
  font-size: 13px;
}

@media (max-width: 860px) {
  .menu-inspector__hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .menu-inspector__stats,
  .menu-inspector__grid {
    grid-template-columns: 1fr;
  }
}
</style>
