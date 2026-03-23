<template>
  <RelationSelectFormItem
    ref="relationSelectRef"
    v-bind="attrs"
    :label="label"
    :model-value="modelValue"
    :request="imageRequest"
    :request-params="resolvedRequestParams"
    :search-defaults="searchDefaults"
    :dialog-title="dialogTitle"
    :trigger-text="triggerText"
    :empty-text="emptyText"
    :dialog-width="dialogWidth"
    :page-size="pageSize"
    :allow-clear="allowClear"
    :show-selected-preview="false"
    :disabled="disabled"
    layout="card"
    @update:model-value="handleModelValueChange"
  >
    <template #trigger="slotProps">
      <slot
        name="trigger"
        :open="slotProps.open"
        :clear="slotProps.clear"
        :selected-image="resolveSelectedImage(slotProps.selectedRows)"
        :selected-count="slotProps.selectedCount"
        :selection-text="slotProps.selectionText"
        :disabled="slotProps.disabled"
      >
        <div
          class="image-select__trigger"
          :class="{
            'image-select__trigger--active': slotProps.selectedCount > 0,
            'image-select__trigger--disabled': slotProps.disabled,
          }"
          role="group"
          :aria-disabled="slotProps.disabled ? 'true' : 'false'"
        >
          <button
            type="button"
            class="image-select__trigger-main"
            :disabled="slotProps.disabled"
            @click="slotProps.open"
          >
            <span class="image-select__trigger-preview">
              <img
                v-if="resolveSelectedImage(slotProps.selectedRows)?.url"
                :src="resolveSelectedImage(slotProps.selectedRows)?.url ?? ''"
                :alt="resolveSelectedImage(slotProps.selectedRows)?.originalName ?? label"
              />
              <span v-else class="image-select__trigger-placeholder">图</span>
            </span>

            <span class="image-select__trigger-copy">
              <span class="image-select__trigger-title">
                {{ resolveTriggerTitle(resolveSelectedImage(slotProps.selectedRows), slotProps.selectedCount) }}
              </span>
              <span class="image-select__trigger-description">
                {{ resolveTriggerDescription(resolveSelectedImage(slotProps.selectedRows), slotProps.selectedCount) }}
              </span>
            </span>

            <span class="image-select__trigger-meta">
              <span
                v-if="slotProps.selectedCount"
                class="image-select__trigger-badge"
              >
                已选
              </span>
              <span class="image-select__trigger-arrow" aria-hidden="true" />
            </span>
          </button>

          <button
            v-if="allowTriggerClear(slotProps.selectedCount)"
            type="button"
            class="image-select__trigger-clear"
            :disabled="slotProps.disabled"
            title="清空当前图片"
            aria-label="清空当前图片"
            @click.stop="slotProps.clear"
          >
            <span class="image-select__trigger-clear-icon" aria-hidden="true" />
          </button>
        </div>
      </slot>
    </template>

    <template v-if="hasSearchSlot" #search="slotProps">
      <slot
        name="search"
        :params="slotProps.params"
        :search="slotProps.search"
        :reset="slotProps.reset"
        :loading="slotProps.loading"
      />
    </template>

    <template v-if="uploadEnabled" #extra>
      <div class="image-select__extra">
        <div
          class="image-select__upload-surface"
          :class="{
            'image-select__upload-surface--dragging': dragActive,
            'image-select__upload-surface--disabled': disabled || uploading || !canUploadInteract,
            'image-select__upload-surface--clickable': clickUpload && !disabled && !uploading,
          }"
          @click="handleUploadSurfaceClick"
          @dragenter.prevent="handleDragEnter"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
        >
          <input
            ref="fileInputRef"
            class="image-select__file-input"
            type="file"
            :accept="acceptAttribute"
            :disabled="disabled || uploading || !canUploadInteract"
            @change="handleFileInputChange"
          />

          <div class="image-select__upload-copy">
            <strong>{{ uploading ? '正在上传图片' : '上传新图片' }}</strong>
            <span>{{ uploadHintText }}</span>
            <span class="image-select__upload-meta">
              格式：{{ acceptText }}
              <template v-if="maxSizeText"> · 最大 {{ maxSizeText }}</template>
            </span>
          </div>

          <div class="image-select__upload-actions">
            <el-button
              v-if="clickUpload"
              type="primary"
              plain
              size="small"
              :loading="uploading"
              :disabled="disabled || uploading || !clickUpload"
              @click.stop="openFileDialog"
            >
              选择图片
            </el-button>
            <span v-if="dragUpload" class="image-select__upload-tip">支持拖拽到此</span>
          </div>
        </div>

        <el-progress
          v-if="uploadProgress !== null"
          :percentage="uploadProgress"
          :status="uploadProgress >= 100 && !uploading ? 'success' : undefined"
        />
      </div>
    </template>

    <template #row="slotProps">
      <slot
        name="row"
        :row="asImageRow(slotProps.row)"
        :selected="slotProps.selected"
        :disabled="slotProps.disabled"
        :toggle="slotProps.toggle"
      >
        <div
          class="image-select__option"
          :class="{ 'image-select__option--selected': slotProps.selected }"
        >
          <div class="image-select__option-preview">
            <img
              v-if="asImageRow(slotProps.row).url"
              :src="asImageRow(slotProps.row).url ?? ''"
              :alt="asImageRow(slotProps.row).originalName"
              loading="lazy"
            />
            <span v-else class="image-select__option-placeholder">无预览</span>
            <span class="image-select__option-indicator">
              {{ slotProps.selected ? '已选中' : '使用图片' }}
            </span>
          </div>

          <div class="image-select__option-copy">
            <strong>{{ asImageRow(slotProps.row).originalName }}</strong>
            <span>{{ resolveImageSummary(asImageRow(slotProps.row)) }}</span>
            <span>
              上传者：{{ asImageRow(slotProps.row).owner.nickname || asImageRow(slotProps.row).owner.username }}
            </span>
          </div>
        </div>
      </slot>
    </template>
  </RelationSelectFormItem>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useAttrs, useSlots } from 'vue';
import { ElMessage } from 'element-plus';
import type { MediaAssetListQuery, MediaAssetRecord, UploadKind } from '@rbac/api-common';
import { api } from '@/api/client';
import { uploadManagedFile } from '@/utils/direct-upload';
import { getErrorMessage } from '@/utils/errors';
import type { RelationSelectRequest, RelationSelectRow } from './relation-select';
import {
  buildImageAcceptAttribute,
  formatImageAcceptText,
  formatFileSize,
  matchImageAccept,
  resolveImageSummary,
} from './image-select';

type RelationSelectFormItemExposed = {
  openDialog: () => void;
  closeDialog: () => void;
  clearSelection: () => void;
  applySearch: () => void;
  resetSearch: () => void;
};

defineOptions({
  name: 'ImageSelectFormItem',
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: string | null | undefined;
    requestParams?: MediaAssetListQuery;
    searchDefaults?: Record<string, string | number | null | undefined>;
    dialogTitle?: string;
    triggerText?: string;
    emptyText?: string;
    dialogWidth?: string | number;
    pageSize?: number;
    disabled?: boolean;
    allowClear?: boolean;
    accept?: string | string[];
    maxSize?: number;
    uploadEnabled?: boolean;
    dragUpload?: boolean;
    clickUpload?: boolean;
    closeOnUpload?: boolean;
    uploadKind?: UploadKind;
    uploadTag1?: string | null;
    uploadTag2?: string | null;
  }>(),
  {
    requestParams: () => ({}),
    searchDefaults: () => ({ q: '' }),
    dialogTitle: undefined,
    triggerText: '',
    emptyText: '暂无可选图片',
    dialogWidth: '960px',
    pageSize: 12,
    disabled: false,
    allowClear: true,
    accept: 'image/*',
    maxSize: undefined,
    uploadEnabled: true,
    dragUpload: true,
    clickUpload: true,
    closeOnUpload: true,
    uploadKind: 'attachment',
    uploadTag1: null,
    uploadTag2: null,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const attrs = useAttrs();
const slots = useSlots();
const relationSelectRef = ref<RelationSelectFormItemExposed | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploadProgress = ref<number | null>(null);
const uploading = ref(false);
const dragActive = ref(false);

const imageRequest = api.attachments.images as unknown as RelationSelectRequest;
const hasSearchSlot = computed(() => Boolean(slots.search));
const acceptAttribute = computed(() => buildImageAcceptAttribute(props.accept));
const acceptText = computed(() => formatImageAcceptText(props.accept));
const maxSizeText = computed(() => (props.maxSize ? formatFileSize(props.maxSize) : ''));
const canUploadInteract = computed(() => props.dragUpload || props.clickUpload);
const resolvedRequestParams = computed<MediaAssetListQuery>(() => ({
  ...(props.requestParams ?? {}),
}));
const uploadHintText = computed(() => {
  if (uploading.value) {
    return '上传完成后会自动回填图片 id';
  }

  if (!canUploadInteract.value) {
    return '当前未启用拖拽或点击上传';
  }

  return props.dragUpload && props.clickUpload
    ? '可直接拖入图片，也可以点击选择文件'
    : props.dragUpload
      ? '将图片拖到这里，上传完成后会自动回填'
      : '点击后选择图片文件，上传完成后会自动回填';
});

const allowTriggerClear = (selectedCount: number) =>
  props.allowClear && selectedCount > 0 && !props.disabled;

const asImageRow = (row: RelationSelectRow) => row as unknown as MediaAssetRecord;

const resolveSelectedImage = (rows: RelationSelectRow[]) => {
  const row = rows[0];
  return row ? asImageRow(row) : null;
};

const normalizeTag = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? '';
  return normalized || null;
};

const resolveTriggerTitle = (selectedImage: MediaAssetRecord | null, selectedCount: number) => {
  if (selectedImage) {
    return selectedImage.originalName;
  }

  if (selectedCount > 0) {
    return '正在加载当前图片';
  }

  return props.triggerText || `选择${props.label}`;
};

const resolveTriggerDescription = (
  selectedImage: MediaAssetRecord | null,
  selectedCount: number,
) => {
  if (selectedImage) {
    return resolveImageSummary(selectedImage);
  }

  if (selectedCount > 0) {
    return '正在回显当前已选图片';
  }

  return props.uploadEnabled ? '可从图库中选择，或直接上传后回填' : '点击打开后选择图片';
};

const resetFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const validateFile = (file: File) => {
  if (!matchImageAccept(file, props.accept)) {
    return `图片格式不支持，仅支持 ${acceptText.value}`;
  }

  if (props.maxSize && file.size > props.maxSize) {
    return `图片大小不能超过 ${formatFileSize(props.maxSize)}`;
  }

  return undefined;
};

const handleModelValueChange = (value: string | string[] | null) => {
  emit('update:modelValue', typeof value === 'string' ? value : null);
};

const openFileDialog = () => {
  if (props.disabled || uploading.value || !props.clickUpload) {
    return;
  }

  fileInputRef.value?.click();
};

const uploadFile = async (file: File) => {
  const validationMessage = validateFile(file);
  if (validationMessage) {
    ElMessage.warning(validationMessage);
    resetFileInput();
    return;
  }

  try {
    uploading.value = true;
    uploadProgress.value = 0;

    const uploaded = await uploadManagedFile(
      {
        kind: props.uploadKind,
        file,
        tag1: normalizeTag(props.uploadTag1),
        tag2: normalizeTag(props.uploadTag2),
      },
      (progress) => {
        uploadProgress.value = progress;
      },
    );

    emit('update:modelValue', uploaded.fileId);
    ElMessage.success('图片上传成功');

    if (props.closeOnUpload) {
      await nextTick();
      relationSelectRef.value?.closeDialog();
    } else {
      relationSelectRef.value?.applySearch();
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '图片上传失败'));
  } finally {
    uploading.value = false;
    dragActive.value = false;
    uploadProgress.value = null;
    resetFileInput();
  }
};

const handleFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];
  if (!file) {
    return;
  }

  void uploadFile(file);
};

const handleUploadSurfaceClick = () => {
  if (!props.clickUpload) {
    return;
  }

  openFileDialog();
};

const handleDragEnter = () => {
  if (!props.dragUpload || props.disabled || uploading.value) {
    return;
  }

  dragActive.value = true;
};

const handleDragOver = () => {
  if (!props.dragUpload || props.disabled || uploading.value) {
    return;
  }

  dragActive.value = true;
};

const handleDragLeave = (event: DragEvent) => {
  if (!props.dragUpload) {
    return;
  }

  const currentTarget = event.currentTarget;
  if (currentTarget instanceof HTMLElement && event.relatedTarget instanceof Node) {
    if (currentTarget.contains(event.relatedTarget)) {
      return;
    }
  }

  dragActive.value = false;
};

const handleDrop = (event: DragEvent) => {
  if (!props.dragUpload || props.disabled || uploading.value) {
    dragActive.value = false;
    return;
  }

  dragActive.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) {
    return;
  }

  void uploadFile(file);
};
</script>

<style scoped lang="scss">
.image-select__trigger {
  display: flex;
  align-items: stretch;
  width: min(100%, 520px);
  border: 1px solid var(--line-soft);
  border-radius: 20px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, white 92%, var(--accent) 4%),
    color-mix(in srgb, var(--surface-1) 96%, var(--accent) 4%)
  );
  box-shadow:
    0 14px 30px rgba(11, 26, 41, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  overflow: hidden;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.image-select__trigger:hover:not(.image-select__trigger--disabled) {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--line-strong));
  box-shadow:
    0 18px 32px rgba(11, 26, 41, 0.08),
    0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent);
  transform: translateY(-1px);
}

.image-select__trigger:focus-within {
  border-color: color-mix(in srgb, var(--accent) 44%, var(--line-strong));
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent),
    0 18px 32px rgba(11, 26, 41, 0.08);
}

.image-select__trigger--active {
  border-color: color-mix(in srgb, var(--accent) 22%, var(--line-strong));
}

.image-select__trigger--disabled {
  opacity: 0.62;
  box-shadow: none;
}

.image-select__trigger-main {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
  padding: 14px 16px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.image-select__trigger-main:disabled {
  cursor: not-allowed;
}

.image-select__trigger-preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 56px;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-1) 86%, var(--accent) 12%);
  overflow: hidden;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--line-soft) 88%, var(--accent) 10%);
}

.image-select__trigger-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-select__trigger-placeholder {
  color: var(--ink-3);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.image-select__trigger-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.image-select__trigger-title {
  display: block;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-select__trigger-description {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.55;
}

.image-select__trigger-meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.image-select__trigger-badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, white);
  color: color-mix(in srgb, var(--accent) 76%, #0f1822);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.image-select__trigger-arrow {
  width: 9px;
  height: 9px;
  margin-right: 2px;
  border-top: 1.5px solid var(--ink-3);
  border-right: 1.5px solid var(--ink-3);
  transform: rotate(45deg);
  opacity: 0.72;
}

.image-select__trigger-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 52px;
  border: 0;
  border-left: 1px solid color-mix(in srgb, var(--line-soft) 82%, var(--accent) 12%);
  background: color-mix(in srgb, var(--surface-1) 84%, var(--accent) 10%);
  color: var(--ink-3);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.image-select__trigger-clear:hover:not(:disabled) {
  background: color-mix(in srgb, #ff6b57 10%, white);
  color: #d1432f;
}

.image-select__trigger-clear:disabled {
  cursor: not-allowed;
}

.image-select__trigger-clear-icon {
  position: relative;
  display: inline-block;
  width: 14px;
  height: 14px;
}

.image-select__trigger-clear-icon::before,
.image-select__trigger-clear-icon::after {
  content: '';
  position: absolute;
  top: 6px;
  left: 0;
  width: 14px;
  height: 1.5px;
  border-radius: 999px;
  background: currentColor;
}

.image-select__trigger-clear-icon::before {
  transform: rotate(45deg);
}

.image-select__trigger-clear-icon::after {
  transform: rotate(-45deg);
}

.image-select__extra {
  display: grid;
  gap: 12px;
}

.image-select__upload-surface {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border: 1px dashed color-mix(in srgb, var(--line-strong) 72%, var(--accent) 18%);
  border-radius: 18px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, white 94%, var(--accent) 4%),
    color-mix(in srgb, var(--surface-1) 92%, var(--accent) 6%)
  );
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.image-select__upload-surface--clickable {
  cursor: pointer;
}

.image-select__upload-surface--clickable:hover {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--line-strong));
  box-shadow: 0 12px 24px rgba(11, 26, 41, 0.08);
  transform: translateY(-1px);
}

.image-select__upload-surface--dragging {
  border-color: color-mix(in srgb, var(--accent) 72%, white);
  background: color-mix(in srgb, var(--accent) 8%, white);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent);
}

.image-select__upload-surface--disabled {
  opacity: 0.66;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.image-select__file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.image-select__upload-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.image-select__upload-copy strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
}

.image-select__upload-copy span {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.55;
}

.image-select__upload-meta {
  color: var(--ink-2);
}

.image-select__upload-actions {
  display: grid;
  justify-items: end;
  gap: 8px;
  flex: 0 0 auto;
}

.image-select__upload-tip {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.image-select__option {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: var(--surface-1);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease,
    background-color 0.18s ease;
}

.image-select__option:hover {
  border-color: color-mix(in srgb, var(--accent) 32%, var(--line-strong));
  box-shadow: 0 16px 30px rgba(11, 26, 41, 0.08);
  transform: translateY(-1px);
}

.image-select__option--selected {
  border-color: color-mix(in srgb, var(--accent) 70%, white);
  background: color-mix(in srgb, var(--accent) 7%, white);
}

.image-select__option-preview {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-1) 86%, var(--accent) 10%);
  overflow: hidden;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--line-soft) 90%, var(--accent) 10%);
}

.image-select__option-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-select__option-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--ink-3);
  font-size: 13px;
  font-weight: 600;
}

.image-select__option-indicator {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(15, 24, 34, 0.72);
  color: white;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.image-select__option-copy {
  display: grid;
  gap: 6px;
}

.image-select__option-copy strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  word-break: break-word;
}

.image-select__option-copy span {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.55;
  word-break: break-word;
}

@media (max-width: 860px) {
  .image-select__upload-surface {
    flex-direction: column;
    align-items: stretch;
  }

  .image-select__upload-actions {
    justify-items: start;
  }
}

@media (max-width: 640px) {
  .image-select__trigger {
    width: 100%;
  }

  .image-select__trigger-preview {
    flex-basis: 48px;
    width: 48px;
    height: 48px;
  }

  .image-select__upload-surface {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
