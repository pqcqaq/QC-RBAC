<template>
  <SurfacePanel
    caption="Navigation Graph"
    title="菜单结构树"
    description="单击查看节点详情，双击直接进入编辑，右键打开快捷菜单。展开状态改为显式控制，避免深层结构把页面整体拖长。"
  >
    <template #actions>
      <el-space wrap :size="8">
        <el-button plain :disabled="treeActionDisabled" @click="emit('expand-all')">展开全部</el-button>
        <el-button plain :disabled="treeActionDisabled" @click="emit('collapse-all')">收起全部</el-button>
        <el-button plain type="primary" :disabled="focusActionDisabled" @click="emit('expand-selection')">展开所选路径</el-button>
      </el-space>
    </template>

    <div class="menu-panel__toolbar">
      <el-input
        :model-value="keyword"
        clearable
        placeholder="搜索标题 / 编码 / 路径 / 权限码"
        @update:model-value="handleKeywordInput"
      />
      <span class="menu-panel__hint">{{ panelHint }}</span>
      <el-tag v-if="isSearching" size="small" effect="plain" type="info">搜索中自动展开命中分支</el-tag>
    </div>

    <ContextMenuHost :items="contextMenuSourceItems" manual>
      <template #default="{ open }">
        <div v-loading="loading" class="menu-tree-shell">
          <el-empty v-if="!nodes.length" description="暂无匹配的菜单节点" />

          <el-scrollbar v-else class="menu-tree-scroll">
            <el-tree
              ref="treeRef"
              :data="nodes"
              node-key="id"
              :default-expanded-keys="expandedKeys"
              highlight-current
              :expand-on-click-node="false"
              :current-node-key="currentNodeKey"
              :indent="18"
              class="menu-tree"
              @node-expand="handleNodeExpand"
              @node-collapse="handleNodeCollapse"
            >
              <template #default="{ data }">
                <div
                  class="menu-tree-node"
                  :class="{ 'is-expandable': data.children.length > 0 }"
                  @click.stop="handleCardClick(data)"
                  @dblclick.stop="handleCardDoubleClick(data)"
                  @contextmenu.stop.prevent="handleCardContextMenu($event, data, open)"
                >
                  <span class="menu-tree-node__icon" :title="data.icon || resolveMenuNodeIcon(data)">
                    <UnoIcon :name="resolveMenuNodeIcon(data)" :title="data.title" :size="18" />
                  </span>

                  <div class="menu-tree-node__body">
                    <div class="menu-tree-node__headline">
                      <strong>{{ data.title }}</strong>
                      <span class="menu-tree-node__type" :class="`is-${data.type.toLowerCase()}`">
                        {{ resolveTypeLabel(data.type) }}
                      </span>
                    </div>

                    <p class="menu-tree-node__subtitle">
                      {{ resolveNodeSubtitle(data) }}
                    </p>

                    <div class="menu-tree-node__meta">
                      <span class="menu-chip">{{ data.code }}</span>
                      <span v-if="data.path" class="menu-chip menu-chip--ghost">{{ data.path }}</span>
                      <span v-if="data.viewKey" class="menu-chip menu-chip--ghost">{{ data.viewKey }}</span>
                      <span v-if="data.type === 'DIRECTORY'" class="menu-chip menu-chip--muted">不绑定权限</span>
                      <span v-else-if="data.permission?.code" class="menu-chip menu-chip--accent">{{ data.permission.code }}</span>
                      <span v-else class="menu-chip menu-chip--muted">未绑定权限</span>
                    </div>
                  </div>

                  <span v-if="data.children.length > 0" class="menu-tree-node__toggle">
                    {{ expandedKeys.includes(data.id) ? '收起' : '展开' }}
                  </span>
                </div>
              </template>
            </el-tree>
          </el-scrollbar>
        </div>
      </template>
    </ContextMenuHost>
  </SurfacePanel>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { MenuNodeRecord } from '@rbac/api-common';
import type { TreeInstance } from 'element-plus';
import ContextMenuHost from '@/components/common/ContextMenuHost.vue';
import UnoIcon from '@/components/common/UnoIcon.vue';
import type { ContextMenuItem, ContextMenuOpenHandler } from '@/components/common/context-menu';
import { resolveMenuNodeIcon } from '@/components/common/uno-icons';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { collectExpandableIds, resolveNodeSubtitle, resolveTypeLabel } from '../menu-management';

type TreeApiNode = {
  childNodes: Array<unknown>;
  collapse: () => void;
  expand: (callback?: (() => void) | null, expandParent?: boolean) => void;
};

type TreeInstanceApi = TreeInstance & {
  getNode: (key: string) => TreeApiNode | null;
  setCurrentKey: (key: string | null, shouldAutoExpandParent?: boolean) => void;
};

const props = defineProps<{
  loading: boolean;
  keyword: string;
  nodes: MenuNodeRecord[];
  totalNodes: number;
  expandedKeys: string[];
  expandedCount: number;
  currentNodeKey: string | undefined;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}>();

const emit = defineEmits<{
  'update:keyword': [value: string];
  select: [node: MenuNodeRecord];
  edit: [node: MenuNodeRecord];
  'create-sibling': [node: MenuNodeRecord];
  'create-child': [node: MenuNodeRecord];
  delete: [node: MenuNodeRecord];
  expand: [node: MenuNodeRecord];
  collapse: [node: MenuNodeRecord];
  'expand-all': [];
  'collapse-all': [];
  'expand-selection': [];
}>();

type HostContextMenuItem = ContextMenuItem<never>;
const treeRef = ref<TreeInstanceApi | null>(null);
const clickTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const isSearching = computed(() => Boolean(props.keyword.trim()));
const treeActionDisabled = computed(() => !props.totalNodes || isSearching.value);
const focusActionDisabled = computed(() => treeActionDisabled.value || !props.currentNodeKey);
const visibleNodes = computed(() => props.nodes.reduce((sum, node) => sum + 1 + countVisibleChildren(node), 0));
const panelHint = computed(() => {
  if (isSearching.value) {
    return `命中 ${visibleNodes.value} / ${props.totalNodes} 个节点`;
  }

  return `共 ${props.totalNodes} 个节点，当前展开 ${props.expandedCount} 个分支`;
});

const countVisibleChildren = (node: MenuNodeRecord): number => node.children.reduce(
  (sum, child) => sum + 1 + countVisibleChildren(child),
  0,
);

const contextMenuItems = computed<ContextMenuItem<MenuNodeRecord>[]>(() => [
  {
    key: 'inspect',
    label: '查看详情',
    description: '同步右侧面板到当前节点',
    onSelect: (node) => {
      emit('select', node);
    },
  },
  {
    key: 'toggle-branch',
    label: (node) => isExpanded(node.id) ? '收起分支' : '展开分支',
    description: (node) => isExpanded(node.id) ? '折叠当前节点下的可见子树' : '展开当前节点下的子树',
    hidden: (node) => !node.children.length || isSearching.value,
    onSelect: (node) => {
      emit('select', node);
      if (isExpanded(node.id)) {
        emit('collapse', node);
        return;
      }
      emit('expand', node);
    },
  },
  {
    key: 'edit',
    label: '编辑节点',
    description: '打开节点编辑弹窗',
    divided: true,
    disabled: () => !props.canUpdate,
    onSelect: (node) => {
      emit('select', node);
      emit('edit', node);
    },
  },
  {
    key: 'create-sibling',
    label: '新增同级',
    description: '在当前层级新增一个节点',
    disabled: () => !props.canCreate,
    onSelect: (node) => {
      emit('select', node);
      emit('create-sibling', node);
    },
  },
  {
    key: 'create-child',
    label: '新增子级',
    description: '在当前节点下继续扩展结构',
    disabled: (node) => !props.canCreate || node.type === 'ACTION',
    onSelect: (node) => {
      emit('select', node);
      emit('create-child', node);
    },
  },
  {
    key: 'delete',
    label: '删除节点',
    description: '删除当前节点及其下属结构',
    danger: true,
    divided: true,
    disabled: () => !props.canDelete,
    onSelect: (node) => {
      emit('select', node);
      emit('delete', node);
    },
  },
]);

const contextMenuSourceItems = computed(() => contextMenuItems.value as unknown as HostContextMenuItem[]);

const syncExpandedState = () => {
  const tree = treeRef.value;
  if (!tree) {
    return;
  }

  const desiredKeys = new Set(props.expandedKeys);
  collectExpandableIds(props.nodes).forEach((nodeId) => {
    const treeNode = tree.getNode(nodeId);
    if (!treeNode) {
      return;
    }

    if (desiredKeys.has(nodeId)) {
      treeNode.expand(null, true);
      return;
    }

    treeNode.collapse();
  });

  tree.setCurrentKey(props.currentNodeKey ?? null, false);
};

const handleKeywordInput = (value: string) => {
  emit('update:keyword', value);
};

const clearClickTimer = () => {
  if (clickTimer.value !== null) {
    clearTimeout(clickTimer.value);
    clickTimer.value = null;
  }
};

const isExpanded = (nodeId: string) => props.expandedKeys.includes(nodeId);

const toggleNodeByCard = (node: MenuNodeRecord) => {
  if (!node.children.length || isSearching.value) {
    return;
  }

  if (isExpanded(node.id)) {
    emit('collapse', node);
    return;
  }

  emit('expand', node);
};

const handleCardClick = (node: MenuNodeRecord) => {
  clearClickTimer();
  clickTimer.value = setTimeout(() => {
    emit('select', node);
    toggleNodeByCard(node);
    clickTimer.value = null;
  }, 180);
};

const handleCardDoubleClick = (node: MenuNodeRecord) => {
  clearClickTimer();
  emit('select', node);
  emit('edit', node);
};

const handleCardContextMenu = (
  event: MouseEvent,
  node: MenuNodeRecord,
  open: ContextMenuOpenHandler<MenuNodeRecord>,
) => {
  clearClickTimer();
  emit('select', node);
  open(event, node);
};

const handleNodeExpand = (node: MenuNodeRecord) => {
  emit('expand', node);

  if (isSearching.value) {
    void nextTick(syncExpandedState);
  }
};

const handleNodeCollapse = (node: MenuNodeRecord) => {
  emit('collapse', node);

  if (isSearching.value) {
    void nextTick(syncExpandedState);
  }
};

watch(
  () => ({
    nodes: props.nodes,
    expandedKeys: props.expandedKeys,
    currentNodeKey: props.currentNodeKey,
  }),
  () => {
    void nextTick(syncExpandedState);
  },
  { deep: true, immediate: true },
);
</script>

<style scoped lang="scss">
.menu-panel__toolbar {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  margin-bottom: 12px;
}

.menu-panel__hint {
  color: var(--ink-3);
  font-size: 12px;
  white-space: nowrap;
}

.menu-tree-shell {
  min-height: 0;
}

.menu-tree-shell :deep(.el-empty) {
  min-height: 280px;
  border: 1px dashed var(--line-strong);
  border-radius: 18px;
  background: color-mix(in srgb, white 90%, var(--surface-2));
}

.menu-tree-scroll {
  max-height: min(72vh, 780px);
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: color-mix(in srgb, white 90%, var(--surface-2));
}

.menu-tree-scroll :deep(.el-scrollbar__view) {
  padding: 8px;
}

.menu-tree {
  background: transparent;
}

.menu-tree :deep(.el-tree-node__content) {
  height: auto;
  padding: 0;
  border-radius: 14px;
  background: transparent;
}

.menu-tree :deep(.el-tree-node__content:hover) {
  background: transparent;
}

.menu-tree :deep(.el-tree-node__expand-icon) {
  margin-right: 2px;
  padding: 4px;
  border-radius: 10px;
  color: var(--ink-3);
  transition: background 0.18s ease, color 0.18s ease;
}

.menu-tree :deep(.el-tree-node__expand-icon:hover) {
  background: color-mix(in srgb, white 84%, var(--surface-2));
  color: var(--accent-strong);
}

.menu-tree :deep(.el-tree-node.is-current > .el-tree-node__content .menu-tree-node) {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--line-strong));
  background: color-mix(in srgb, white 82%, var(--accent) 8%);
  box-shadow: var(--shadow-panel);
}

.menu-tree-node {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 1px 0;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.menu-tree-node:hover {
  border-color: color-mix(in srgb, var(--accent) 16%, var(--line-strong));
  background: color-mix(in srgb, white 92%, var(--surface-2));
}

.menu-tree-node__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 11%, white);
  color: color-mix(in srgb, var(--accent) 76%, #143255);
}

.menu-tree-node__body {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.menu-tree-node__headline {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.menu-tree-node__headline strong {
  min-width: 0;
  color: var(--ink-1);
  font-size: 13px;
  line-height: 1.3;
}

.menu-tree-node__type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
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

.menu-tree-node__subtitle {
  margin: 0;
  color: var(--ink-3);
  font-size: 11px;
  line-height: 1.45;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.menu-tree-node__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.menu-chip {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 8%, white);
  color: var(--ink-2);
  font-size: 10px;
  font-weight: 600;
}

.menu-tree-node__toggle {
  flex: 0 0 auto;
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.menu-chip--ghost {
  background: color-mix(in srgb, white 84%, var(--surface-2));
  color: var(--ink-3);
}

.menu-chip--muted {
  background: color-mix(in srgb, white 78%, var(--surface-2));
  color: var(--ink-3);
}

.menu-chip--accent {
  background: color-mix(in srgb, var(--accent) 14%, white);
  color: var(--accent-strong);
}

@media (max-width: 860px) {
  .menu-panel__toolbar {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .menu-tree-node,
  .menu-tree-node__headline {
    align-items: flex-start;
    flex-direction: column;
  }

  .menu-tree-node__body,
  .menu-tree-node__headline {
    width: 100%;
  }
}
</style>
