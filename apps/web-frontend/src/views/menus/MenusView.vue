<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="reloadAll">刷新结构</el-button>
        <el-button type="primary" :disabled="!canCreate" @click="openCreateRootDialog('DIRECTORY')">新增目录</el-button>
        <el-button type="primary" plain :disabled="!canCreate" @click="openCreateRootDialog('PAGE')">新增页面</el-button>
      </el-space>
    </template>

    <div class="menu-management-grid">
      <SurfacePanel
        caption="Navigation Graph"
        title="菜单结构树"
        description="单击查看节点详情，双击直接进入编辑。副标题只展示副标题语义，路径与权限改为标签信息。"
      >
        <div class="menu-panel__toolbar">
          <el-input
            v-model="keyword"
            clearable
            placeholder="搜索标题 / 编码 / 路径 / 权限码"
          />
          <span class="menu-panel__hint">共 {{ flattenNodes(tree).length }} 个节点</span>
        </div>

        <div v-loading="loading" class="menu-tree-shell">
          <el-empty v-if="!filteredTree.length" description="暂无匹配的菜单节点" />

          <el-tree
            v-else
            :data="filteredTree"
            node-key="id"
            default-expand-all
            highlight-current
            :expand-on-click-node="false"
            :current-node-key="currentNodeKey"
            :indent="18"
            class="menu-tree"
            @node-click="handleSelectNode"
          >
            <template #default="{ data }">
              <div class="menu-tree-node" @dblclick.stop="openEditDialog(data)">
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
              </div>
            </template>
          </el-tree>
        </div>
      </SurfacePanel>

      <SurfacePanel
        caption="Inspector"
        :title="selectedNode ? selectedNode.title : '选择一个节点'"
        :description="selectedNode ? inspectorDescription : '从左侧选择一个节点，右侧查看结构信息并发起新增、编辑、删除。'"
      >
        <template v-if="selectedNode" #actions>
          <el-space wrap>
            <el-button plain :disabled="!canUpdate" @click="openEditDialog(selectedNode)">编辑</el-button>
            <el-button plain :disabled="!canCreate" @click="openCreateSiblingDialog">新增同级</el-button>
            <el-button
              plain
              type="primary"
              :disabled="!canCreate || selectedNode.type === 'ACTION'"
              @click="openCreateChildDialog(selectedNode)"
            >
              新增子级
            </el-button>
            <el-button
              plain
              type="danger"
              :disabled="!canDelete"
              @click="openDeleteDialog(selectedNode)"
            >
              删除
            </el-button>
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
    </div>

    <el-dialog
      v-model="editorVisible"
      :title="editorTitle"
      width="840px"
      top="6vh"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="menu-dialog__intro">
        <div class="menu-dialog__intro-copy">
          <p class="panel-caption">{{ formMode === 'edit' ? 'Edit Node' : 'Create Node' }}</p>
          <h4>{{ editorTitle }}</h4>
          <p>{{ editorDescription }}</p>
        </div>

        <el-tag round>{{ formMode === 'edit' ? '编辑模式' : '新建模式' }}</el-tag>
      </div>

      <el-form label-position="top" class="page-form-grid">
        <el-form-item label="节点类型">
          <el-select v-model="form.type" :disabled="formMode === 'edit' && Boolean(selectedNode?.children.length)">
            <el-option
              v-for="option in typeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="父节点">
          <el-select v-model="form.parentId" clearable placeholder="根节点">
            <el-option
              v-for="option in parentOptions"
              :key="option.id"
              :label="option.label"
              :value="option.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="排序值">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
        </el-form-item>

        <el-form-item label="节点编码">
          <el-input v-model="form.code" placeholder="如 users / menus-create" />
        </el-form-item>

        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="菜单展示标题" />
        </el-form-item>

        <el-form-item label="菜单图标">
          <UnoIconPicker v-model="form.icon" :fallback="previewIcon" />
        </el-form-item>

        <el-form-item label="副标题">
          <el-input v-model="form.caption" placeholder="菜单第二行的简短说明，建议少于 16 个字" />
        </el-form-item>

        <el-form-item label="描述" class="page-form-grid__full">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="节点说明，可选" />
        </el-form-item>

        <el-form-item v-if="form.type === 'PAGE'" label="页面路径">
          <el-input v-model="form.path" placeholder="/menus" />
        </el-form-item>

        <el-form-item v-if="form.type === 'PAGE'" label="页面视图">
          <el-select v-model="form.viewKey" filterable placeholder="选择前端页面视图">
            <el-option
              v-for="option in pageViewOptions"
              :key="option.viewKey"
              :label="option.label"
              :value="option.viewKey"
              :disabled="option.disabled"
            />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.type !== 'DIRECTORY'" label="权限绑定" class="page-form-grid__full">
          <el-select
            v-model="form.permissionId"
            clearable
            filterable
            :disabled="!canAssignPermission"
            placeholder="页面与行为节点可绑定权限"
          >
            <el-option-group
              v-for="group in permissionGroups"
              :key="group.module"
              :label="group.module"
            >
              <el-option
                v-for="permission in group.items"
                :key="permission.id"
                :label="`${permission.name} (${permission.code})`"
                :value="permission.id"
              />
            </el-option-group>
          </el-select>
        </el-form-item>
      </el-form>

      <div class="menu-editor__hint">
        <strong>结构约束</strong>
        <span>{{ structureHint }}</span>
      </div>

      <template #footer>
        <el-button @click="resetEditor">恢复初始值</el-button>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!canSubmit" @click="saveNode">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="deleteVisible"
      title="删除菜单节点"
      width="520px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div v-if="pendingDeleteNode" class="menu-delete-dialog">
        <div class="menu-delete-dialog__hero">
          <span class="menu-delete-dialog__icon">
            <UnoIcon :name="resolveMenuNodeIcon(pendingDeleteNode)" :title="pendingDeleteNode.title" :size="24" />
          </span>

          <div class="menu-delete-dialog__copy">
            <strong>{{ pendingDeleteNode.title }}</strong>
            <span>{{ resolveTypeLabel(pendingDeleteNode.type) }} · {{ pendingDeleteNode.code }}</span>
          </div>
        </div>

        <p class="menu-delete-dialog__warning">
          {{ pendingDeleteDescendantCount
            ? `该节点下还有 ${pendingDeleteDescendantCount} 个子节点，确认后会一并删除。`
            : '删除后不可恢复，请确认这是你期望的操作。' }}
        </p>

        <div class="menu-delete-dialog__facts">
          <article class="menu-inspector__kv">
            <span>页面路径</span>
            <strong>{{ pendingDeleteNode.path || '不适用' }}</strong>
          </article>
          <article class="menu-inspector__kv">
            <span>权限绑定</span>
            <strong>{{ resolvePermissionSummary(pendingDeleteNode) }}</strong>
          </article>
        </div>
      </div>

      <template #footer>
        <el-button @click="closeDeleteDialog">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="confirmDelete">确认删除</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { MenuNodeFormPayload, MenuNodeRecord, PermissionSummary } from '@rbac/api-common';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import UnoIcon from '@/components/common/UnoIcon.vue';
import UnoIconPicker from '@/components/common/UnoIconPicker.vue';
import { resolveMenuNodeIcon } from '@/components/common/uno-icons';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { api } from '@/api/client';
import { pageRegistry } from '@/meta/pages';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';
import { useWorkbenchStore } from '@/stores/workbench';
import { getErrorMessage } from '@/utils/errors';

defineOptions({ name: 'MenusView' });

definePage({
  viewKey: 'menus',
  keepAlive: true,
});

type MenuNodeType = MenuNodeFormPayload['type'];
type EditorMode = 'create' | 'edit';
type RootCreatableNodeType = Extract<MenuNodeType, 'DIRECTORY' | 'PAGE'>;
type PageViewOption = {
  viewKey: string;
  label: string;
  disabled: boolean;
};

const typeLabels: Record<MenuNodeType, string> = {
  DIRECTORY: '目录',
  PAGE: '页面',
  ACTION: '行为',
};

const typeOptions = [
  { value: 'DIRECTORY', label: '目录' },
  { value: 'PAGE', label: '页面' },
  { value: 'ACTION', label: '行为' },
] satisfies Array<{ value: MenuNodeType; label: string }>;

const menus = useMenuStore();
const workbench = useWorkbenchStore();
const router = useRouter();
const auth = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const keyword = ref('');
const selectedNodeId = ref<string | null>(null);
const permissions = ref<PermissionSummary[]>([]);
const tree = ref<MenuNodeRecord[]>([]);
const formMode = ref<EditorMode>('create');
const editorVisible = ref(false);
const deleteVisible = ref(false);
const pendingDeleteNodeId = ref<string | null>(null);

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

const canCreate = computed(() => auth.hasPermission('menu.create'));
const canUpdate = computed(() => auth.hasPermission('menu.update'));
const canDelete = computed(() => auth.hasPermission('menu.delete'));
const canAssignPermission = computed(() => auth.hasPermission('menu.assign-permission'));
const canSubmit = computed(() => (formMode.value === 'create' ? canCreate.value : canUpdate.value));
const currentNodeKey = computed(() => selectedNodeId.value ?? undefined);
const selectedNode = computed(() => findNodeById(tree.value, selectedNodeId.value));
const selectedParentNode = computed(() => findNodeById(tree.value, selectedNode.value?.parentId ?? null));
const pendingDeleteNode = computed(() => findNodeById(tree.value, pendingDeleteNodeId.value));
const pendingDeleteDescendantCount = computed(() => pendingDeleteNode.value ? countDescendants(pendingDeleteNode.value) : 0);

const stats = computed(() => {
  const nodes = flattenNodes(tree.value);
  return [
    { label: '节点总数', value: nodes.length },
    { label: '目录节点', value: nodes.filter((node) => node.type === 'DIRECTORY').length },
    { label: '页面节点', value: nodes.filter((node) => node.type === 'PAGE').length },
    { label: '行为节点', value: nodes.filter((node) => node.type === 'ACTION').length },
  ];
});

const editorTitle = computed(() => formMode.value === 'edit' ? '编辑菜单节点' : '新建菜单节点');
const editorDescription = computed(() => {
  if (formMode.value === 'edit' && selectedNode.value) {
    return `正在编辑 ${selectedNode.value.title}，修改会立即影响导航树与权限映射。`;
  }

  const parent = findNodeById(tree.value, form.parentId ?? null);
  if (parent) {
    return `新节点将挂载到 ${parent.title} 下。`;
  }

  return '新节点会作为根节点插入当前菜单树。';
});

const inspectorDescription = computed(() => {
  if (!selectedNode.value) {
    return '';
  }

  return `${selectedNode.value.code}${selectedNode.value.path ? ` · ${selectedNode.value.path}` : ''}`;
});

const previewIcon = computed(() => resolveMenuNodeIcon({
  code: form.code.trim(),
  type: form.type,
  icon: form.icon,
}));

const structureHint = computed(() => resolveStructureHint(form.type));
const resolveTypeLabel = (type: MenuNodeType) => typeLabels[type];
const formatTime = (value: string) => new Date(value).toLocaleString();

const flattenNodes = (nodes: MenuNodeRecord[]): MenuNodeRecord[] => nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);

const findNodeById = (nodes: MenuNodeRecord[], id: string | null): MenuNodeRecord | null => {
  if (!id) {
    return null;
  }

  const queue = [...nodes];
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.id === id) {
      return current;
    }

    queue.push(...current.children);
  }

  return null;
};

const resolveNodeSubtitle = (node: Pick<MenuNodeRecord, 'type' | 'caption' | 'description' | 'permission'>) => {
  const caption = node.caption?.trim();
  if (caption) {
    return caption;
  }

  const description = node.description?.trim();
  if (description) {
    return description;
  }

  if (node.type === 'PAGE') {
    return '路由页面入口';
  }

  if (node.type === 'ACTION') {
    return node.permission?.name || '页面内操作权限';
  }

  return '用于组织页面分组与目录层级';
};

const resolveStructureHint = (type: MenuNodeType) => {
  if (type === 'DIRECTORY') {
    return '目录下只能继续挂目录或页面，且目录本身不能绑定权限。';
  }

  if (type === 'PAGE') {
    return '页面节点必须配置 path 与 viewKey，且页面下只能挂行为节点。';
  }

  return '行为节点只能挂在页面下，用于承接页面内的按钮或动作权限。';
};

const resolvePermissionSummary = (node: Pick<MenuNodeRecord, 'type' | 'permission'>) => {
  if (node.type === 'DIRECTORY') {
    return '目录节点不绑定权限';
  }

  if (node.permission) {
    return `${node.permission.name} (${node.permission.code})`;
  }

  return '未绑定权限';
};

const countDescendants = (node: MenuNodeRecord): number => node.children.reduce(
  (sum, child) => sum + 1 + countDescendants(child),
  0,
);

const filterTree = (nodes: MenuNodeRecord[], query: string): MenuNodeRecord[] => {
  const keywordValue = query.trim().toLowerCase();
  if (!keywordValue) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const children = filterTree(node.children, query);
    const searchable = [
      node.title,
      node.caption ?? '',
      node.description ?? '',
      node.code,
      node.icon ?? '',
      node.path ?? '',
      node.viewKey ?? '',
      node.permission?.code ?? '',
    ].join(' ').toLowerCase();

    if (!searchable.includes(keywordValue) && !children.length) {
      return [];
    }

    return [{ ...node, children }];
  });
};

const filteredTree = computed(() => filterTree(tree.value, keyword.value));

const collectDescendantIds = (node: MenuNodeRecord | null): Set<string> => {
  if (!node) {
    return new Set<string>();
  }

  const ids = new Set<string>([node.id]);
  const queue = [...node.children];

  while (queue.length) {
    const current = queue.shift();
    if (!current || ids.has(current.id)) {
      continue;
    }

    ids.add(current.id);
    queue.push(...current.children);
  }

  return ids;
};

const parentOptions = computed(() => {
  const editingNode = selectedNode.value;
  const disallowedIds = formMode.value === 'edit' ? collectDescendantIds(editingNode) : new Set<string>();
  const options: Array<{ id: string; label: string }> = [];

  const visit = (nodes: MenuNodeRecord[], depth: number) => {
    nodes.forEach((node) => {
      if (disallowedIds.has(node.id)) {
        return;
      }

      const isAllowedParent = form.type === 'DIRECTORY'
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
  const editingId = formMode.value === 'edit' ? selectedNode.value?.id ?? null : null;
  const usedViewKeys = new Set(
    flattenNodes(tree.value)
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

const permissionGroups = computed(() => {
  const grouped = permissions.value.reduce<Record<string, PermissionSummary[]>>((result, permission) => {
    result[permission.module] ??= [];
    result[permission.module].push(permission);
    return result;
  }, {});

  return Object.entries(grouped)
    .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
    .map(([module, items]) => ({
      module,
      items: items.sort((left, right) => left.code.localeCompare(right.code, 'zh-CN')),
    }));
});

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

const nextSortOrder = (siblings: MenuNodeRecord[]) => Math.max(...siblings.map((item) => item.sortOrder), 0) + 10;
const resolveDefaultCreateType = (parent: MenuNodeRecord): MenuNodeType => parent.type === 'PAGE' ? 'ACTION' : 'PAGE';

const resetEditor = () => {
  patchForm(editorSeed.value);
};

const openEditDialog = (node: MenuNodeRecord) => {
  if (!canUpdate.value) {
    return;
  }

  selectedNodeId.value = node.id;
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

const openCreateSiblingDialog = () => {
  if (!canCreate.value) {
    return;
  }

  if (!selectedNode.value) {
    openCreateRootDialog('DIRECTORY');
    return;
  }

  const siblings = selectedNode.value.parentId
    ? findNodeById(tree.value, selectedNode.value.parentId)?.children ?? tree.value
    : tree.value;

  openEditor('create', {
    ...createEmptyForm(),
    type: selectedNode.value.type,
    parentId: selectedNode.value.parentId ?? null,
    sortOrder: nextSortOrder(siblings),
  });
};

const openCreateChildDialog = (node: MenuNodeRecord) => {
  if (!canCreate.value || node.type === 'ACTION') {
    return;
  }

  selectedNodeId.value = node.id;
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
  pendingDeleteNodeId.value = node.id;
  deleteVisible.value = true;
};

const closeDeleteDialog = () => {
  deleteVisible.value = false;
  pendingDeleteNodeId.value = null;
};

const handleSelectNode = (node: MenuNodeRecord) => {
  selectedNodeId.value = node.id;
};

const ensureSelection = (nodes: MenuNodeRecord[]) => {
  if (selectedNodeId.value && findNodeById(nodes, selectedNodeId.value)) {
    return;
  }

  selectedNodeId.value = nodes[0]?.id ?? null;
};

const reloadAll = async () => {
  try {
    loading.value = true;
    const [menuTree] = await Promise.all([
      api.menus.tree(),
      api.menus.permissions().then((items) => {
        permissions.value = items;
      }),
      menus.refresh(router),
    ]);

    tree.value = menuTree;
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

const validatePayload = (payload: MenuNodeFormPayload): string | null => {
  if (!payload.code) {
    return '请填写节点编码';
  }

  if (!payload.title) {
    return '请填写节点标题';
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

  return null;
};

const saveNode = async () => {
  try {
    const payload = toPayload();
    const validationError = validatePayload(payload);
    if (validationError) {
      ElMessage.warning(validationError);
      return;
    }

    const editingNodeId = formMode.value === 'edit' ? selectedNode.value?.id ?? null : null;

    saving.value = true;
    const response = editingNodeId
      ? await api.menus.update(editingNodeId, payload)
      : await api.menus.create(payload);

    ElMessage.success(formMode.value === 'edit' ? '菜单节点已更新' : '菜单节点已创建');
    editorVisible.value = false;
    selectedNodeId.value = response.id;
    await reloadAll();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存菜单节点失败'));
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
    ElMessage.success('菜单节点已删除');
    closeDeleteDialog();
    selectedNodeId.value = fallbackSelectionId;
    await reloadAll();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '删除菜单节点失败'));
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
  grid-template-columns: minmax(340px, 0.9fr) minmax(420px, 1.1fr);
}

.menu-panel__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.menu-panel__hint {
  color: var(--ink-3);
  font-size: 12px;
  white-space: nowrap;
}

.menu-tree-shell {
  min-height: 560px;
}

.menu-tree {
  border: 1px solid var(--line-soft);
  border-radius: 22px;
  padding: 12px;
  background: color-mix(in srgb, white 90%, var(--surface-2));
}

.menu-tree :deep(.el-tree-node__content) {
  height: auto;
  padding: 0;
  border-radius: 20px;
  background: transparent;
}

.menu-tree :deep(.el-tree-node__content:hover) {
  background: transparent;
}

.menu-tree :deep(.el-tree-node__expand-icon) {
  color: var(--ink-3);
}

.menu-tree :deep(.el-tree-node.is-current > .el-tree-node__content .menu-tree-node) {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--line-strong));
  background: color-mix(in srgb, white 82%, var(--accent) 8%);
  box-shadow: var(--shadow-panel);
}

.menu-tree-node {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  width: 100%;
  margin: 3px 0;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 18px;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.menu-tree-node:hover {
  border-color: color-mix(in srgb, var(--accent) 16%, var(--line-strong));
  background: color-mix(in srgb, white 92%, var(--surface-2));
}

.menu-tree-node__icon,
.menu-inspector__icon,
.menu-delete-dialog__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: color-mix(in srgb, var(--accent) 76%, #143255);
}

.menu-tree-node__icon {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 11%, white);
}

.menu-tree-node__body {
  display: grid;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.menu-tree-node__headline {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.menu-tree-node__headline strong {
  min-width: 0;
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.3;
}

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

.menu-tree-node__subtitle,
.menu-inspector__subtitle,
.menu-dialog__intro p {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.55;
}

.menu-tree-node__subtitle {
  margin: 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.menu-tree-node__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.menu-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 8%, white);
  color: var(--ink-2);
  font-size: 11px;
  font-weight: 600;
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

.menu-inspector__icon,
.menu-delete-dialog__icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent) 12%, white);
}

.menu-inspector__hero-copy {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.menu-inspector__hero-copy h3,
.menu-dialog__intro h4 {
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

.menu-inspector__grid,
.menu-delete-dialog__facts {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.menu-inspector__kv--full {
  grid-column: 1 / -1;
}

.menu-dialog__intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  padding: 16px 18px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: color-mix(in srgb, white 94%, var(--surface-2));
}

.menu-dialog__intro-copy {
  display: grid;
  gap: 6px;
}

.menu-dialog__intro-copy p:last-child {
  margin: 0;
}

.menu-editor__hint {
  display: grid;
  gap: 6px;
  margin-top: 8px;
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

.menu-delete-dialog {
  display: grid;
  gap: 16px;
}

.menu-delete-dialog__hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, #ff6b57 22%, var(--line-soft));
  border-radius: 18px;
  background: color-mix(in srgb, #fff1ee 84%, white);
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

@media (max-width: 1280px) {
  .menu-management-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .menu-panel__toolbar,
  .menu-dialog__intro,
  .menu-inspector__hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .menu-inspector__stats,
  .menu-inspector__grid,
  .menu-delete-dialog__facts {
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

  .menu-panel__hint {
    display: none;
  }
}
</style>
