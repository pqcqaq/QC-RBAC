import type { OptionEndpoint, OptionSearchPayload, PaginatedResult } from '@rbac/api-common';

export type RelationSelectRow = {
  id: string;
  name?: string;
  title?: string;
  label?: string;
  code?: string;
  module?: string;
  action?: string;
  description?: string;
};

export type RelationSelectModelValue = string | string[] | null | undefined;
export type RelationSelectLayout = 'list' | 'card';

export type RelationSelectRequestParams = OptionSearchPayload & {
  page: number;
  pageSize: number;
};

export type RelationSelectRequest = OptionEndpoint<
  RelationSelectRow,
  PaginatedResult<RelationSelectRow>,
  RelationSelectRequestParams
>;

export const normalizeRelationSelectValue = (
  value: RelationSelectModelValue,
  multiple: boolean,
) => {
  if (multiple) {
    return Array.isArray(value)
      ? [...new Set(value.filter((item): item is string => Boolean(item)))]
      : [];
  }

  if (typeof value === 'string' && value) {
    return [value];
  }

  return [];
};

export const resolveRelationRowLabel = (row: RelationSelectRow) => {
  const record = row as Record<string, unknown>;
  const labelKeys = ['name', 'title', 'label', 'code', 'id'] as const;

  for (const key of labelKeys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return row.id;
};

export const resolveRelationRowMeta = (row: RelationSelectRow) => {
  const record = row as Record<string, unknown>;
  const candidates = [record.code, record.module, record.action, record.description].filter(
    (item): item is string => typeof item === 'string' && Boolean(item.trim()),
  );

  return candidates.length ? candidates.join(' · ') : '';
};
