import {
  normalizeWsSubscriptionTopic,
  type RealtimeTopicFormPayload,
  type RealtimeTopicRecord,
} from '@rbac/api-common';

export type RealtimeTopicEditorForm = {
  code: string;
  name: string;
  description: string;
  topicPattern: string;
  permissionId: string | null;
};

export const createEmptyRealtimeTopicEditorForm = (): RealtimeTopicEditorForm => ({
  code: '',
  name: '',
  description: '',
  topicPattern: '',
  permissionId: null,
});

export const assignRealtimeTopicEditorForm = (
  form: RealtimeTopicEditorForm,
  record: RealtimeTopicRecord,
) => {
  form.code = record.code;
  form.name = record.name;
  form.description = record.description ?? '';
  form.topicPattern = record.topicPattern;
  form.permissionId = record.permissionId;
};

export const buildRealtimeTopicPayload = (
  form: RealtimeTopicEditorForm,
): RealtimeTopicFormPayload => ({
  code: form.code.trim(),
  name: form.name.trim(),
  description: form.description.trim() || null,
  topicPattern: normalizeWsSubscriptionTopic(form.topicPattern),
  permissionId: form.permissionId ?? '',
});

export const validateRealtimeTopicForm = (form: RealtimeTopicEditorForm) => {
  if (!form.code.trim() || !form.name.trim() || !form.topicPattern.trim() || !form.permissionId) {
    return '请完整填写编码、名称、Topic Pattern 和权限';
  }

  try {
    normalizeWsSubscriptionTopic(form.topicPattern);
  } catch (error) {
    return error instanceof Error ? `Topic Pattern 无效：${error.message}` : 'Topic Pattern 无效';
  }

  return undefined;
};

export const resolveRealtimeTopicSourceLabel = (isSystem: boolean) =>
  isSystem ? '系统注册' : '自定义绑定';

export const formatRealtimeTopicPermissionSummary = (record: RealtimeTopicRecord) =>
  `${record.permission.name} · ${record.permission.code}`;

export const buildRealtimeTopicClipboardSummary = (record: RealtimeTopicRecord) =>
  [
    record.name,
    record.topicPattern,
    formatRealtimeTopicPermissionSummary(record),
  ].join('\n');

export const buildRealtimeTopicDetailEntries = (record: RealtimeTopicRecord) => [
  { label: 'Topic Pattern', value: record.topicPattern },
  { label: '权限名称', value: record.permission.name },
  { label: '权限编码', value: record.permission.code },
  { label: '权限模块', value: `${record.permission.module} · ${record.permission.action}` },
  { label: '来源', value: resolveRealtimeTopicSourceLabel(record.isSystem) },
  { label: '创建时间', value: new Date(record.createdAt).toLocaleString() },
  { label: '更新时间', value: new Date(record.updatedAt).toLocaleString() },
];
