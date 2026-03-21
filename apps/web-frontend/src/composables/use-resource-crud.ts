import { computed, reactive, ref, shallowRef } from 'vue';
import type { ComputedRef, Ref, ShallowRef } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getErrorMessage, isDialogCancellation } from '@/utils/errors';

type ResourceId = string;

type EditorMessages = {
  createSuccess: string;
  updateSuccess: string;
  saveError: string;
};

type EditorOptions<TRecord, TForm extends Record<string, unknown>, TPayload> = {
  createEmptyForm: () => TForm;
  getId: (record: TRecord) => ResourceId;
  assignForm: (form: TForm, record: TRecord) => void;
  buildPayload: (form: TForm, editingId: ResourceId | null) => TPayload;
  create: (payload: TPayload) => Promise<unknown>;
  update: (id: ResourceId, payload: TPayload) => Promise<unknown>;
  validate?: (form: TForm, editingId: ResourceId | null) => string | undefined;
  afterOpenCreate?: () => void;
  afterOpenEdit?: (record: TRecord) => void;
  afterSaved?: () => Promise<void> | void;
  messages: EditorMessages;
};

type DetailOptions<TRecord, TDetail> = {
  getId: (record: TRecord) => ResourceId;
  loadDetail: (id: ResourceId) => Promise<TDetail>;
  errorMessage: string;
};

type RemoveOptions<TRecord> = {
  getId: (record: TRecord) => ResourceId;
  remove: (id: ResourceId) => Promise<unknown>;
  confirmTitle: string | ((record: TRecord) => string);
  confirmMessage: string | ((record: TRecord) => string);
  successMessage: string;
  errorMessage: string;
  afterRemoved?: () => Promise<void> | void;
};

type ResourceEditorResult<TRecord, TForm extends Record<string, unknown>> = {
  dialogVisible: Ref<boolean>;
  editingId: Ref<ResourceId | null>;
  form: TForm;
  isEditing: ComputedRef<boolean>;
  openCreate: () => void;
  openEdit: (record: TRecord) => void;
  resetForm: () => void;
  save: () => Promise<boolean>;
};

type ResourceDetailResult<TRecord, TDetail> = {
  detailVisible: Ref<boolean>;
  detail: ShallowRef<TDetail | null>;
  openDetail: (record: TRecord) => Promise<void>;
};

type ResourceRemovalResult<TRecord> = {
  removeRecord: (record: TRecord) => Promise<void>;
};

const resolveMaybeFactory = <TRecord>(value: string | ((record: TRecord) => string), record: TRecord) =>
  typeof value === 'function' ? value(record) : value;

export const useResourceEditor = <
  TRecord,
  TForm extends Record<string, unknown>,
  TPayload,
>(
  options: EditorOptions<TRecord, TForm, TPayload>,
): ResourceEditorResult<TRecord, TForm> => {
  const dialogVisible = ref(false);
  const editingId = ref<ResourceId | null>(null);
  const form = reactive(options.createEmptyForm()) as TForm;
  const isEditing = computed(() => Boolean(editingId.value));

  const resetForm = () => {
    Object.assign(form, options.createEmptyForm());
  };

  const openCreate = () => {
    editingId.value = null;
    resetForm();
    options.afterOpenCreate?.();
    dialogVisible.value = true;
  };

  const openEdit = (record: TRecord) => {
    editingId.value = options.getId(record);
    resetForm();
    options.assignForm(form, record);
    options.afterOpenEdit?.(record);
    dialogVisible.value = true;
  };

  const save = async () => {
    try {
      const validationMessage = options.validate?.(form, editingId.value);
      if (validationMessage) {
        ElMessage.warning(validationMessage);
        return false;
      }

      const payload = options.buildPayload(form, editingId.value);
      if (editingId.value) {
        await options.update(editingId.value, payload);
        ElMessage.success(options.messages.updateSuccess);
      } else {
        await options.create(payload);
        ElMessage.success(options.messages.createSuccess);
      }

      dialogVisible.value = false;
      await options.afterSaved?.();
      return true;
    } catch (error: unknown) {
      ElMessage.error(getErrorMessage(error, options.messages.saveError));
      return false;
    }
  };

  return {
    dialogVisible,
    editingId,
    form,
    isEditing,
    openCreate,
    openEdit,
    resetForm,
    save,
  };
};

export const useResourceDetail = <TRecord, TDetail>(
  options: DetailOptions<TRecord, TDetail>,
): ResourceDetailResult<TRecord, TDetail> => {
  const detailVisible = ref(false);
  const detail = shallowRef<TDetail | null>(null);

  const openDetail = async (record: TRecord) => {
    try {
      detail.value = await options.loadDetail(options.getId(record));
      detailVisible.value = true;
    } catch (error: unknown) {
      ElMessage.error(getErrorMessage(error, options.errorMessage));
    }
  };

  return {
    detailVisible,
    detail,
    openDetail,
  };
};

export const useResourceRemoval = <TRecord>(
  options: RemoveOptions<TRecord>,
): ResourceRemovalResult<TRecord> => {
  const removeRecord = async (record: TRecord) => {
    try {
      await ElMessageBox.confirm(
        resolveMaybeFactory(options.confirmMessage, record),
        resolveMaybeFactory(options.confirmTitle, record),
        { type: 'warning' },
      );
      await options.remove(options.getId(record));
      ElMessage.success(options.successMessage);
      await options.afterRemoved?.();
    } catch (error: unknown) {
      if (isDialogCancellation(error)) {
        return;
      }

      ElMessage.error(getErrorMessage(error, options.errorMessage));
    }
  };

  return {
    removeRecord,
  };
};
