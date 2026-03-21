export type AccessOperator = 'and' | 'or';

export type AccessDirectiveObject = {
  value?: string | string[];
  items?: string | string[];
  mode?: AccessOperator;
  operator?: AccessOperator;
};

export type AccessDirectiveValue = string | string[] | AccessDirectiveObject | null | undefined;

const normalizeItems = (value: string | string[] | undefined): string[] => {
  if (!value) {
    return [];
  }

  const rawItems = Array.isArray(value) ? value : [value];
  return rawItems
    .map((item) => item.trim())
    .filter(Boolean);
};

export const normalizeAccessDirectiveValue = (value: AccessDirectiveValue): string[] => {
  if (!value) {
    return [];
  }

  if (typeof value === 'string' || Array.isArray(value)) {
    return normalizeItems(value);
  }

  return normalizeItems(value.items ?? value.value);
};

export const resolveAccessOperator = (
  arg: string | undefined,
  value: AccessDirectiveValue,
): AccessOperator => {
  if (arg === 'and' || arg === 'or') {
    return arg;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.mode === 'and' || value.mode === 'or') {
      return value.mode;
    }

    if (value.operator === 'and' || value.operator === 'or') {
      return value.operator;
    }
  }

  return 'or';
};

export const matchAccess = (
  source: Iterable<string>,
  value: AccessDirectiveValue,
  arg?: string,
): boolean => {
  const requiredItems = normalizeAccessDirectiveValue(value);
  if (!requiredItems.length) {
    return true;
  }

  const currentItems = new Set(source);
  const mode = resolveAccessOperator(arg, value);

  if (mode === 'and') {
    return requiredItems.every((item) => currentItems.has(item));
  }

  return requiredItems.some((item) => currentItems.has(item));
};
