<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="reloadAll">刷新结构</el-button>
        <el-button
          v-permission="'menu.create'"
          type="primary"
          @click="openCreateRootDialog('DIRECTORY')"
          >新增目录</el-button
        >
        <el-button
          v-permission="'menu.create'"
          type="primary"
          plain
          @click="openCreateRootDialog('PAGE')"
          >新增页面</el-button
        >
      </el-space>
    </template>

    <div class="menu-management-grid">
      <MenuTreePanel
        :loading="loading"
        :keyword="keyword"
        :nodes="filteredTree"
        :total-nodes="totalNodeCount"
        :expanded-keys="treeExpandedKeys"
        :expanded-count="expandedBranchCount"
        :current-node-key="currentNodeKey"
        :can-create="canCreate"
        :can-update="canUpdate"
        :can-delete="canDelete"
        @update:keyword="keyword = $event"
        @select="handleSelectNode"
        @edit="openEditDialog"
        @create-sibling="openCreateSiblingDialog"
        @create-child="openCreateChildDialog"
        @delete="openDeleteDialog"
        @expand="handleExpandNode"
        @collapse="handleCollapseNode"
        @expand-all="expandAllNodes"
        @collapse-all="collapseAllNodes"
        @expand-selection="expandSelectionPath"
      />

      <MenuInspectorPanel
        :selected-node="selectedNode"
        :selected-parent-node="selectedParentNode"
        :description="inspectorDescription"
        @edit="handleInspectorEdit"
        @create-sibling="openCreateSiblingDialog"
        @create-child="handleInspectorCreateChild"
        @delete="handleInspectorDelete"
      />
    </div>

    <MenuEditorDialog
      v-model:visible="editorVisible"
      :title="editorTitle"
      :mode="formMode"
      :description="editorDescription"
      :form="form"
      :lock-type="formMode === 'edit' && Boolean(selectedNode?.children.length)"
      :parent-options="parentOptions"
      :page-view-options="pageViewOptions"
      :can-assign-permission="canAssignPermission"
      :can-create-permission="canCreatePermission"
      :preview-icon="previewIcon"
      :structure-hint="structureHint"
      :saving="saving"
      :can-submit="canSubmit"
      @reset="resetEditor"
      @open-create-permission="openPermissionCreateDialog"
      @save="saveNode"
    />

    <PermissionEditorDialog
      v-model:visible="permissionDialogVisible"
      title="新增权限"
      :seed-permission-locked="false"
      :form="permissionForm"
      @save="savePermissionFromMenu"
    />

    <MenuDeleteDialog
      :visible="deleteVisible"
      :deleting="deleting"
      :node="pendingDeleteNode"
      :descendant-count="pendingDeleteDescendantCount"
      @update:visible="handleDeleteVisibleChange"
      @confirm="confirmDelete"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type {
  MenuNodeFormPayload,
  MenuNodeRecord,
  PermissionFormPayload,
} from '@rbac/api-common';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { resolveMenuNodeIcon } from '@/components/common/uno-icons';
import PermissionEditorDialog from '@/components/permissions/PermissionEditorDialog.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { api } from '@/api/client';
import { pageRegistry } from '@/meta/pages';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';
import { useWorkbenchStore } from '@/stores/workbench';
import { getErrorMessage } from '@/utils/errors';
import MenuDeleteDialog from './components/MenuDeleteDialog.vue';
import MenuEditorDialog from './components/MenuEditorDialog.vue';
import MenuInspectorPanel from './components/MenuInspectorPanel.vue';
import MenuTreePanel from './components/MenuTreePanel.vue';
import {
  collectDescendantIds,
  collectExpandableIds,
  countDescendants,
  deriveActionCodeFromPermissionCode,
  filterTree,
  findNodeById,
  findNodePath,
  flattenNodes,
  resolveEntityLabel,
  resolveStructureHint,
} from './menu-management';
import type { EditorMode, MenuNodeType, RootCreatableNodeType } from './menu-management';

defineOptions({ name: 'MenusView' });

definePage({
  viewKey: 'menus',
  keepAlive: true,
});

type PageViewOption = {
  viewKey: string;
  label: string;
  disabled: boolean;
};

const menus = useMenuStore();
const workbench = useWorkbenchStore();
const router = useRouter();
const auth = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const keyword = ref('');
const selectedNodeId = ref<string | null>(null);
const tree = ref<MenuNodeRecord[]>([]);
const expandedNodeIds = ref<string[]>([]);
const formMode = ref<EditorMode>('create');
const editorVisible = ref(false);
const deleteVisible = ref(false);
const pendingDeleteNodeId = ref<string | null>(null);
const permissionDialogVisible = ref(false);
const permissionSaving = ref(false);

const createEmptyForm = (): MenuNodeFormPayload => ({
  code: '',
  type: 'DIRECTORY',
  title: '',
  caption: '',
  description: '',
  icon: '',
  path: '',
  viewKey: '',
  sortOrder: 10,
  parentId: null,
  permissionId: null,
});

const form = reactive<MenuNodeFormPayload>(createEmptyForm());
const editorSeed = ref<MenuNodeFormPayload>(createEmptyForm());
const createEmptyPermissionForm = () => ({
  code: '',
  name: '',
  module: '',
  action: '',
  description: '',
});
const permissionForm = reactive(createEmptyPermissionForm());

const canCreate = computed(() => auth.hasPermission('menu.create'));
const canUpdate = computed(() => auth.hasPermission('menu.update'));
const canDelete = computed(() => auth.hasPermission('menu.delete'));
const canAssignPermission = computed(() => auth.hasPermission('menu.assign-permission'));
const canCreatePermission = computed(
  () => canAssignPermission.value && auth.hasPermission('permission.create'),
);
const canSubmit = computed(() => (formMode.value === 'create' ? canCreate.value : canUpdate.value));

const allNodes = computed(() => flattenNodes(tree.value));
const totalNodeCount = computed(() => allNodes.value.length);
const currentNodeKey = computed(() => selectedNodeId.value ?? undefined);
const selectedNode = computed(() => findNodeById(tree.value, selectedNodeId.value));
const selectedParentNode = computed(() =>
  findNodeById(tree.value, selectedNode.value?.parentId ?? null),
);
const pendingDeleteNode = computed(() => findNodeById(tree.value, pendingDeleteNodeId.value));
const formParentNode = computed(() => findNodeById(tree.value, form.parentId ?? null));
const pendingDeleteDescendantCount = computed(() =>
  pendingDeleteNode.value ? countDescendants(pendingDeleteNode.value) : 0,
);
const filteredTree = computed(() => filterTree(tree.value, keyword.value));
const treeExpandedKeys = computed(() =>
  keyword.value.trim() ? collectExpandableIds(filteredTree.value) : expandedNodeIds.value,
);
const expandedBranchCount = computed(() => expandedNodeIds.value.length);

const stats = computed(() => [
  { label: '节点总数', value: totalNodeCount.value },
  { label: '目录节点', value: allNodes.value.filter((node) => node.type === 'DIRECTORY').length },
  { label: '页面节点', value: allNodes.value.filter((node) => node.type === 'PAGE').length },
  { label: '行为节点', value: allNodes.value.filter((node) => node.type === 'ACTION').length },
]);

const editorTitle = computed(() => `${formMode.value === 'edit' ? '编辑' : '新增'}${resolveEntityLabel(form.type)}`);
const editorDescription = computed(() => {
  if (formMode.value === 'edit' && selectedNode.value) {
    return `正在编辑 ${selectedNode.value.title}，保存后会立即同步到导航树和权限映射。`;
  }

  const parent = formParentNode.value;
  if (parent) {
    return `${resolveEntityLabel(form.type)}会挂载到 ${parent.title} 下。`;
  }

  return `${resolveEntityLabel(form.type)}会作为根级项插入当前菜单树。`;
});

const inspectorDescription = computed(() => {
  if (!selectedNode.value) {
    return '';
  }

  return `${selectedNode.value.code}${selectedNode.value.path ? ` · ${selectedNode.value.path}` : ''}`;
});

const previewIcon = computed(() =>
  resolveMenuNodeIcon({
    code: form.code.trim(),
    type: form.type,
    icon: form.icon,
  }),
);

const structureHint = computed(() => resolveStructureHint(form.type));

const syncExpandedPath = (nodeId: string | null, mode: 'merge' | 'replace' = 'merge') => {
  const pathIds = findNodePath(tree.value, nodeId)
    .filter((node) => node.children.length > 0)
    .map((node) => node.id);

  if (mode === 'replace') {
    expandedNodeIds.value = pathIds;
    return;
  }

  expandedNodeIds.value = Array.from(new Set([...expandedNodeIds.value, ...pathIds]));
};

const trimExpandedState = (nodes: MenuNodeRecord[]) => {
  const validIds = new Set(collectExpandableIds(nodes));
  expandedNodeIds.value = expandedNodeIds.value.filter((id) => validIds.has(id));
};

const toPayload = (): MenuNodeFormPayload => ({
  code: form.code.trim(),
  type: form.type,
  title: form.title.trim(),
  caption: form.caption?.trim() || null,
  description: form.description?.trim() || null,
  icon: form.icon?.trim() || null,
  path: form.type === 'PAGE' ? form.path?.trim() || null : null,
  viewKey: form.type === 'PAGE' ? form.viewKey?.trim() || null : null,
  sortOrder: Number(form.sortOrder),
  parentId: form.parentId || null,
  permissionId: form.type === 'DIRECTORY' ? null : form.permissionId || null,
});

const patchForm = (payload: MenuNodeFormPayload) => {
  form.code = payload.code;
  form.type = payload.type;
  form.title = payload.title;
  form.caption = payload.caption ?? '';
  form.description = payload.description ?? '';
  form.icon = payload.icon ?? '';
  form.path = payload.path ?? '';
  form.viewKey = payload.viewKey ?? '';
  form.sortOrder = payload.sortOrder;
  form.parentId = payload.parentId ?? null;
  form.permissionId = payload.permissionId ?? null;
};

const openEditor = (mode: EditorMode, payload: MenuNodeFormPayload) => {
  formMode.value = mode;
  editorSeed.value = { ...payload };
  patchForm(payload);
  editorVisible.value = true;
};

const nextSortOrder = (siblings: MenuNodeRecord[]) =>
  Math.max(...siblings.map((item) => item.sortOrder), 0) + 10;
const resolveDefaultCreateType = (parent: MenuNodeRecord): MenuNodeType =>
  parent.type === 'PAGE' ? 'ACTION' : 'PAGE';

const resetEditor = () => {
  patchForm(editorSeed.value);
};

const resetPermissionForm = () => {
  Object.assign(permissionForm, createEmptyPermissionForm());
};

const resolveSuggestedPermissionModule = () => {
  if (formParentNode.value?.permission?.module) {
    return formParentNode.value.permission.module;
  }

  return formParentNode.value?.code ?? '';
};

const openPermissionCreateDialog = () => {
  if (!canCreatePermission.value) {
    return;
  }

  resetPermissionForm();
  permissionForm.name = form.title.trim();
  permissionForm.module = resolveSuggestedPermissionModule();
  permissionDialogVisible.value = true;
};

const validatePermissionForm = () => {
  if (
    !permissionForm.code.trim() ||
    !permissionForm.name.trim() ||
    !permissionForm.module.trim() ||
    !permissionForm.action.trim()
  ) {
    return '请完整填写权限码、名称、模块和动作';
  }

  return null;
};

const savePermissionFromMenu = async () => {
  const validationError = validatePermissionForm();
  if (validationError) {
    ElMessage.warning(validationError);
    return;
  }

  try {
    permissionSaving.value = true;
    const payload: PermissionFormPayload = {
      code: permissionForm.code.trim(),
      name: permissionForm.name.trim(),
      module: permissionForm.module.trim(),
      action: permissionForm.action.trim(),
      description: permissionForm.description.trim(),
    };
    const created = await api.permissions.create(payload);

    form.permissionId = created.id;
    if (form.type === 'ACTION') {
      if (!form.title.trim()) {
        form.title = created.name;
      }
      if (!form.code.trim()) {
        form.code = deriveActionCodeFromPermissionCode(created.code);
      }
    }

    permissionDialogVisible.value = false;
    ElMessage.success('权限已新增并关联到当前行为');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '新增权限失败'));
  } finally {
    permissionSaving.value = false;
  }
};

watch(editorVisible, (value) => {
  if (!value) {
    permissionDialogVisible.value = false;
  }
});

const handleSelectNode = (node: MenuNodeRecord) => {
  selectedNodeId.value = node.id;
  syncExpandedPath(node.id);
};

const handleExpandNode = (node: MenuNodeRecord) => {
  if (keyword.value.trim()) {
    return;
  }

  expandedNodeIds.value = Array.from(new Set([...expandedNodeIds.value, node.id]));
};

const handleCollapseNode = (node: MenuNodeRecord) => {
  if (keyword.value.trim()) {
    return;
  }

  const collapsedIds = collectDescendantIds(node);
  expandedNodeIds.value = expandedNodeIds.value.filter((id) => !collapsedIds.has(id));

  if (
    selectedNodeId.value &&
    collapsedIds.has(selectedNodeId.value) &&
    selectedNodeId.value !== node.id
  ) {
    selectedNodeId.value = node.id;
  }
};

const expandAllNodes = () => {
  expandedNodeIds.value = collectExpandableIds(tree.value);
};

const collapseAllNodes = () => {
  expandedNodeIds.value = [];
  const path = findNodePath(tree.value, selectedNodeId.value);
  selectedNodeId.value = path[0]?.id ?? selectedNodeId.value;
};

const expandSelectionPath = () => {
  syncExpandedPath(selectedNodeId.value);
};

const handleInspectorEdit = () => {
  if (selectedNode.value) {
    openEditDialog(selectedNode.value);
  }
};

const handleInspectorCreateChild = () => {
  if (selectedNode.value) {
    openCreateChildDialog(selectedNode.value);
  }
};

const handleInspectorDelete = () => {
  if (selectedNode.value) {
    openDeleteDialog(selectedNode.value);
  }
};

const openEditDialog = (node: MenuNodeRecord) => {
  if (!canUpdate.value) {
    return;
  }

  selectedNodeId.value = node.id;
  syncExpandedPath(node.id);
  openEditor('edit', {
    code: node.code,
    type: node.type,
    title: node.title,
    caption: node.caption ?? '',
    description: node.description ?? '',
    icon: node.icon ?? '',
    path: node.path ?? '',
    viewKey: node.viewKey ?? '',
    sortOrder: node.sortOrder,
    parentId: node.parentId ?? null,
    permissionId: node.permissionId ?? null,
  });
};

const openCreateRootDialog = (type: RootCreatableNodeType) => {
  if (!canCreate.value) {
    return;
  }

  openEditor('create', {
    ...createEmptyForm(),
    type,
    sortOrder: nextSortOrder(tree.value),
  });
};

const openCreateSiblingDialog = (targetNode = selectedNode.value) => {
  if (!canCreate.value) {
    return;
  }

  if (!targetNode) {
    openCreateRootDialog('DIRECTORY');
    return;
  }

  selectedNodeId.value = targetNode.id;
  syncExpandedPath(targetNode.id);

  const siblings = targetNode.parentId
    ? (findNodeById(tree.value, targetNode.parentId)?.children ?? tree.value)
    : tree.value;

  openEditor('create', {
    ...createEmptyForm(),
    type: targetNode.type,
    parentId: targetNode.parentId ?? null,
    sortOrder: nextSortOrder(siblings),
  });
};

const openCreateChildDialog = (node: MenuNodeRecord) => {
  if (!canCreate.value || node.type === 'ACTION') {
    return;
  }

  selectedNodeId.value = node.id;
  syncExpandedPath(node.id);
  openEditor('create', {
    ...createEmptyForm(),
    type: resolveDefaultCreateType(node),
    parentId: node.id,
    sortOrder: nextSortOrder(node.children),
  });
};

const openDeleteDialog = (node: MenuNodeRecord) => {
  if (!canDelete.value) {
    return;
  }

  selectedNodeId.value = node.id;
  syncExpandedPath(node.id);
  pendingDeleteNodeId.value = node.id;
  deleteVisible.value = true;
};

const closeDeleteDialog = () => {
  deleteVisible.value = false;
  pendingDeleteNodeId.value = null;
};

const handleDeleteVisibleChange = (value: boolean) => {
  if (!value) {
    closeDeleteDialog();
    return;
  }

  deleteVisible.value = value;
};

const ensureSelection = (nodes: MenuNodeRecord[]) => {
  if (!nodes.length) {
    selectedNodeId.value = null;
    return;
  }

  if (!selectedNodeId.value || !findNodeById(nodes, selectedNodeId.value)) {
    selectedNodeId.value = nodes[0]?.id ?? null;
  }

  syncExpandedPath(selectedNodeId.value);
};

const reloadAll = async () => {
  try {
    loading.value = true;
    const [menuTree] = await Promise.all([api.menus.tree(), menus.refresh(router)]);

    tree.value = menuTree;
    trimExpandedState(menuTree);
    workbench.syncWithMenus();
    ensureSelection(menuTree);

    if (pendingDeleteNodeId.value && !findNodeById(menuTree, pendingDeleteNodeId.value)) {
      closeDeleteDialog();
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载菜单结构失败'));
  } finally {
    loading.value = false;
  }
};

const parentOptions = computed(() => {
  const editingNode = selectedNode.value;
  const disallowedIds =
    formMode.value === 'edit' ? collectDescendantIds(editingNode) : new Set<string>();
  const options: Array<{ id: string; label: string }> = [];

  const visit = (nodes: MenuNodeRecord[], depth: number) => {
    nodes.forEach((node) => {
      if (disallowedIds.has(node.id)) {
        return;
      }

      const isAllowedParent =
        form.type === 'DIRECTORY'
          ? node.type === 'DIRECTORY'
          : form.type === 'PAGE'
            ? node.type === 'DIRECTORY'
            : node.type === 'PAGE';

      if (isAllowedParent) {
        options.push({
          id: node.id,
          label: `${'　'.repeat(depth)}${node.title} · ${node.code}`,
        });
      }

      visit(node.children, depth + 1);
    });
  };

  visit(tree.value, 0);
  return options;
});

const pageViewOptions = computed<PageViewOption[]>(() => {
  const editingId = formMode.value === 'edit' ? (selectedNode.value?.id ?? null) : null;
  const usedViewKeys = new Set(
    allNodes.value
      .filter((node) => node.type === 'PAGE' && node.viewKey && node.id !== editingId)
      .map((node) => node.viewKey as string),
  );

  return [...pageRegistry]
    .sort((left, right) => left.viewKey.localeCompare(right.viewKey, 'en'))
    .map((page) => ({
      viewKey: page.viewKey,
      label: `${page.viewKey}${page.title ? ` · ${page.title}` : ''}`,
      disabled: usedViewKeys.has(page.viewKey),
    }));
});

const validatePayload = (payload: MenuNodeFormPayload): string | null => {
  if (payload.type !== 'ACTION' && !payload.code) {
    return payload.type === 'PAGE' ? '请填写页面标识' : '请填写目录标识';
  }

  if (!payload.title) {
    if (payload.type === 'ACTION') {
      return '请填写行为名称';
    }

    return payload.type === 'PAGE' ? '请填写页面标题' : '请填写目录名称';
  }

  if (!Number.isFinite(payload.sortOrder)) {
    return '排序值无效';
  }

  if (payload.type === 'PAGE') {
    if (!payload.path) {
      return '页面节点必须填写页面路径';
    }

    if (!payload.path.startsWith('/')) {
      return '页面路径必须以 / 开头';
    }

    if (!payload.viewKey) {
      return '页面节点必须选择页面视图';
    }
  }

  if (payload.type === 'ACTION' && !payload.parentId) {
    return '行为节点必须挂载到页面节点下';
  }

  if (payload.type === 'ACTION' && formMode.value === 'create' && !payload.permissionId) {
    return '新增行为前请先关联权限，或先新建权限再回填';
  }

  return null;
};

const resolveActionPermission = async (permissionId: string) => {
  const resolved = await api.menus.permissions.resolve([permissionId]);
  return resolved[0] ?? null;
};

const saveNode = async () => {
  try {
    const payload = toPayload();
    if (payload.type === 'ACTION' && !payload.code && payload.permissionId) {
      const permission = await resolveActionPermission(payload.permissionId);
      if (permission) {
        payload.code = deriveActionCodeFromPermissionCode(permission.code);
      }
    }
    const validationError = validatePayload(payload);
    if (validationError) {
      ElMessage.warning(validationError);
      return;
    }

    const editingNodeId = formMode.value === 'edit' ? (selectedNode.value?.id ?? null) : null;

    saving.value = true;
    const response = editingNodeId
      ? await api.menus.update(editingNodeId, payload)
      : await api.menus.create(payload);

    ElMessage.success(formMode.value === 'edit' ? '菜单项已更新' : '菜单项已创建');
    editorVisible.value = false;
    selectedNodeId.value = response.id;
    await reloadAll();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存菜单项失败'));
  } finally {
    saving.value = false;
  }
};

const confirmDelete = async () => {
  if (!pendingDeleteNode.value) {
    return;
  }

  const fallbackSelectionId = pendingDeleteNode.value.parentId ?? null;

  try {
    deleting.value = true;
    await api.menus.remove(pendingDeleteNode.value.id);
    ElMessage.success('菜单项已删除');
    closeDeleteDialog();
    selectedNodeId.value = fallbackSelectionId;
    await reloadAll();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '删除菜单项失败'));
  } finally {
    deleting.value = false;
  }
};

onMounted(reloadAll);
</script>

<style scoped lang="scss">
.menu-management-grid {
  display: grid;
  gap: 24px;
  align-items: start;
  grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.92fr);
}

.menu-management-grid > * {
  min-width: 0;
}

@media (max-width: 1280px) {
  .menu-management-grid {
    grid-template-columns: 1fr;
  }
}
</style>
