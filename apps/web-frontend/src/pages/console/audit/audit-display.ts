import type {
  RequestAuditAuthMode,
  RequestAuditOperationAccessKind,
  RequestAuditOperationEffectKind,
  RequestAuditOperationRecord,
} from '@rbac/api-common';

export type AuditFilters = {
  q: string;
  method: string;
  model: string;
  operation: string;
  status: string;
};

export type AuditFilterToken = {
  key: keyof AuditFilters;
  label: string;
  value: string;
};

export type AuditSignalItem = {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'accent' | 'danger';
};

export type AuditModelCount = {
  model: string;
  count: number;
};

export type AuditWriteEffectChange = {
  field: string;
  before: unknown;
  after: unknown;
};

export type AuditWriteEffectRecord = {
  id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changes: AuditWriteEffectChange[];
};

type AuditReadEffectSummary = {
  resultType?: string;
  resultCount?: number;
  returnedIds: string[];
  truncated: boolean;
};

type AuditWriteEffectSummary = {
  changedRecordCount?: number;
  result?: unknown;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const toStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter(isString) : [];

const getEffectSummaryRecord = (effect: unknown) =>
  isObjectRecord(effect) && isObjectRecord(effect.summary)
    ? effect.summary
    : null;

export const hasMeaningfulAuditValue = (value: unknown) => {
  if (value == null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isObjectRecord(value)) {
    return Object.keys(value).length > 0;
  }

  return true;
};

export const formatAuditTime = (value: string) => new Date(value).toLocaleString();

export const formatAuditDuration = (value: number) => {
  if (value < 1000) {
    return `${value}ms`;
  }

  if (value < 60_000) {
    return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`;
  }

  return `${(value / 60_000).toFixed(1)}min`;
};

export const shortenAuditId = (value: string) =>
  value.length > 16
    ? `${value.slice(0, 8)}...${value.slice(-6)}`
    : value;

export const formatAuditJson = (value: unknown) => JSON.stringify(value ?? null, null, 2);

export const formatInlineAuditValue = (value: unknown) => {
  const raw = value == null
    ? 'null'
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);

  return raw.length > 84 ? `${raw.slice(0, 81)}...` : raw;
};

export const getActiveAuditFilterTokens = (filters: AuditFilters): AuditFilterToken[] => [
  filters.q ? { key: 'q', label: '关键词', value: filters.q } : null,
  filters.method ? { key: 'method', label: '方法', value: filters.method } : null,
  filters.model ? { key: 'model', label: '模型', value: filters.model } : null,
  filters.operation ? { key: 'operation', label: '操作', value: filters.operation } : null,
  filters.status
    ? {
        key: 'status',
        label: '结果',
        value: filters.status === 'success' ? '成功' : '失败',
      }
    : null,
].filter((item): item is AuditFilterToken => Boolean(item));

export const formatAuditAuthMode = (mode: RequestAuditAuthMode) => {
  switch (mode) {
    case 'LOCAL':
      return '本地会话';
    case 'OAUTH':
      return 'OAuth/OIDC';
    case 'ANONYMOUS':
      return '匿名请求';
    default:
      return mode;
  }
};

export const formatOperationEffectKind = (kind: RequestAuditOperationEffectKind) =>
  kind === 'READ' ? '读取' : '写入';

export const formatOperationAccessKind = (kind: RequestAuditOperationAccessKind) =>
  kind === 'MANAGED' ? '托管 Prisma' : '原始 Prisma';

export const getOperationLabel = (operation: RequestAuditOperationRecord) =>
  operation.effectiveOperation && operation.effectiveOperation !== operation.operation
    ? `${operation.model}.${operation.operation} → ${operation.effectiveOperation}`
    : `${operation.model}.${operation.operation}`;

export const getPrimaryOperationLabel = (operations: RequestAuditOperationRecord[]) => {
  const primary = operations.find(item => item.effectKind === 'WRITE') ?? operations[0];
  return primary ? getOperationLabel(primary) : '';
};

export const getReadEffectSummary = (effect: unknown): AuditReadEffectSummary | null => {
  const summary = getEffectSummaryRecord(effect);
  if (!summary || !('resultType' in summary || 'resultCount' in summary || 'returnedIds' in summary)) {
    return null;
  }

  return {
    resultType: isString(summary.resultType) ? summary.resultType : undefined,
    resultCount: isNumber(summary.resultCount) ? summary.resultCount : undefined,
    returnedIds: toStringArray(summary.returnedIds),
    truncated: summary.truncated === true,
  };
};

export const getReadEffectPreview = (effect: unknown) =>
  isObjectRecord(effect) && 'preview' in effect ? effect.preview : undefined;

export const getWriteEffectSummary = (effect: unknown): AuditWriteEffectSummary | null => {
  const summary = getEffectSummaryRecord(effect);
  if (!summary || !('changedRecordCount' in summary || 'result' in summary)) {
    return null;
  }

  return {
    changedRecordCount: isNumber(summary.changedRecordCount) ? summary.changedRecordCount : undefined,
    result: summary.result,
  };
};

export const getWriteEffectRecords = (effect: unknown): AuditWriteEffectRecord[] => {
  if (!isObjectRecord(effect) || !Array.isArray(effect.records)) {
    return [];
  }

  return effect.records.flatMap((item) => {
    if (!isObjectRecord(item) || !isString(item.id)) {
      return [];
    }

    const changes = Array.isArray(item.changes)
      ? item.changes.flatMap((change) => {
          if (!isObjectRecord(change) || !isString(change.field)) {
            return [];
          }

          return [{
            field: change.field,
            before: 'before' in change ? change.before : null,
            after: 'after' in change ? change.after : null,
          }];
        })
      : [];

    return [{
      id: item.id,
      before: isObjectRecord(item.before) ? item.before : null,
      after: isObjectRecord(item.after) ? item.after : null,
      changes,
    }];
  });
};
