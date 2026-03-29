import { Prisma } from './prisma-generated';
import { HttpError } from '../utils/errors';

const sensitiveFieldNames = new Set([
  'accessToken',
  'appSecret',
  'authorization',
  'clientSecret',
  'clientSecretEncrypted',
  'clientSecretHash',
  'codeHash',
  'cookie',
  'credentialHash',
  'encryptedValue',
  'password',
  'refreshToken',
  'salt',
  'secret',
  'secretHash',
  'token',
  'tokenHash',
  'uploadToken',
].map(field => field.toLowerCase()));

const sensitiveFieldSuffixes = ['hash', 'password', 'salt', 'secret', 'token'];

const queryArgKeys = new Set([
  'where',
  'select',
  'include',
  'orderBy',
  'cursor',
  'skip',
  'take',
  'distinct',
]);

const mutationArgKeys = new Set([
  'data',
  'create',
  'update',
]);

const maxDepth = 7;
const maxReadPreviewItems = 20;
const maxStringLength = 1024;

export type RuntimeOperationAccessKind = 'MANAGED' | 'RAW';

export type RuntimeOperationEffectKind = 'READ' | 'WRITE';

export type RuntimeOperationCapture = {
  model: string;
  operation: string;
  effectiveOperation: string;
  accessKind: RuntimeOperationAccessKind;
  effectKind: RuntimeOperationEffectKind;
  inTransaction: boolean;
  softDelete: boolean;
  succeeded: boolean;
  primaryEntityId: string | null;
  affectedCount: number;
  affectedIds: string[];
  query?: unknown;
  mutation?: unknown;
  result?: unknown;
  effect?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
};

export type RuntimeRequestFailure = {
  code: string;
  message: string;
  detail?: unknown;
};

type AuditJsonOptions = {
  arrayLimit?: number;
  depth?: number;
  key?: string;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
  && !Buffer.isBuffer(value);

const isSensitiveFieldName = (key?: string | null) =>
  typeof key === 'string'
  && (() => {
    const normalized = key.toLowerCase();
    return sensitiveFieldNames.has(normalized)
      || sensitiveFieldSuffixes.some(suffix => normalized.endsWith(suffix));
  })();

const normalizeAuditValue = (
  value: unknown,
  options: AuditJsonOptions = {},
): unknown => {
  const depth = options.depth ?? 0;
  if (depth > maxDepth) {
    return '[MaxDepth]';
  }

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (isSensitiveFieldName(options.key)) {
    return '[REDACTED]';
  }

  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    if (typeof value === 'string' && value.length > maxStringLength) {
      return `${value.slice(0, maxStringLength)}...[truncated:${value.length}]`;
    }
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer:${value.length}]`;
  }

  if (Array.isArray(value)) {
    const limit = options.arrayLimit ?? Number.POSITIVE_INFINITY;
    const items = value
      .slice(0, limit)
      .map(item =>
        normalizeAuditValue(item, {
          arrayLimit: options.arrayLimit,
          depth: depth + 1,
        }));
    if (value.length > limit) {
      items.push({
        __auditTruncated: true,
        omittedCount: value.length - limit,
      });
    }
    return items;
  }

  if (value instanceof Set) {
    return normalizeAuditValue([...value], {
      arrayLimit: options.arrayLimit,
      depth: depth + 1,
    });
  }

  if (value instanceof Map) {
    return normalizeAuditValue(Object.fromEntries(value), {
      arrayLimit: options.arrayLimit,
      depth: depth + 1,
    });
  }

  if (!isPlainObject(value)) {
    return String(value);
  }

  const result: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, nestedValue]) => {
    const normalized = normalizeAuditValue(nestedValue, {
      arrayLimit: options.arrayLimit,
      depth: depth + 1,
      key,
    });
    if (normalized !== undefined) {
      result[key] = normalized;
    }
  });
  return result;
};

export const toAuditJson = (
  value: unknown,
  options: Omit<AuditJsonOptions, 'depth'> = {},
) => normalizeAuditValue(value, {
  ...options,
  depth: 0,
});

const toComparableString = (value: unknown) => JSON.stringify(value ?? null);

const buildFieldChanges = (
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) => {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  return [...keys]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .flatMap((field) => {
      const previous = before?.[field];
      const next = after?.[field];
      if (toComparableString(previous) === toComparableString(next)) {
        return [];
      }

      return [{
        field,
        before: previous ?? null,
        after: next ?? null,
      }];
    });
};

const toRowMap = (rows: Array<Record<string, unknown>>) =>
  rows.reduce<Map<string, Record<string, unknown>>>((map, row) => {
    const id = typeof row.id === 'string' ? row.id : null;
    if (id) {
      map.set(id, row);
    }
    return map;
  }, new Map<string, Record<string, unknown>>());

export const extractRecordIds = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .flatMap(item => extractRecordIds(item))
      .filter((id, index, items) => items.indexOf(id) === index);
  }

  if (!isPlainObject(value)) {
    return [];
  }

  return typeof value.id === 'string' ? [value.id] : [];
};

export const buildReadOperationEffect = (result: unknown) => {
  const ids = extractRecordIds(result);
  const resultType = Array.isArray(result)
    ? 'collection'
    : typeof result === 'number'
      ? 'count'
      : result === null
        ? 'empty'
        : 'single';

  return {
    preview: toAuditJson(result, { arrayLimit: maxReadPreviewItems }),
    summary: {
      resultType,
      resultCount: Array.isArray(result) ? result.length : result == null ? 0 : 1,
      returnedIds: ids,
      truncated: Array.isArray(result) && result.length > maxReadPreviewItems,
    },
  };
};

export const buildWriteOperationEffect = (input: {
  beforeRows: Array<Record<string, unknown>>;
  afterRows: Array<Record<string, unknown>>;
  result: unknown;
}) => {
  const beforeMap = toRowMap(input.beforeRows);
  const afterMap = toRowMap(input.afterRows);
  const ids = [...new Set([
    ...beforeMap.keys(),
    ...afterMap.keys(),
  ])];

  const records = ids.map((id) => {
    const before = toAuditJson(beforeMap.get(id) ?? null) as Record<string, unknown> | null;
    const after = toAuditJson(afterMap.get(id) ?? null) as Record<string, unknown> | null;
    return {
      id,
      before,
      after,
      changes: buildFieldChanges(before, after),
    };
  });

  return {
    records,
    summary: {
      changedRecordCount: records.length,
      result: toAuditJson(input.result),
    },
  };
};

export const classifyOperationEffectKind = (
  operation: string,
): RuntimeOperationEffectKind => {
  if (
    operation.startsWith('find')
    || operation === 'count'
    || operation === 'aggregate'
    || operation === 'groupBy'
  ) {
    return 'READ';
  }

  return 'WRITE';
};

export const splitOperationAuditArgs = (
  requestedArgs?: Record<string, unknown>,
  effectiveArgs?: Record<string, unknown>,
) => {
  const query: Record<string, unknown> = {};
  const mutation: Record<string, unknown> = {};

  const collect = (
    source: Record<string, unknown> | undefined,
    prefix: 'requested' | 'effective',
  ) => {
    if (!source) {
      return;
    }

    const queryEntry: Record<string, unknown> = {};
    const mutationEntry: Record<string, unknown> = {};

    Object.entries(source).forEach(([key, value]) => {
      if (queryArgKeys.has(key)) {
        queryEntry[key] = value;
        return;
      }
      if (mutationArgKeys.has(key)) {
        mutationEntry[key] = value;
      }
    });

    if (Object.keys(queryEntry).length) {
      query[prefix] = toAuditJson(queryEntry);
    }

    if (Object.keys(mutationEntry).length) {
      mutation[prefix] = toAuditJson(mutationEntry);
    }
  };

  collect(requestedArgs, 'requested');
  collect(effectiveArgs, 'effective');

  return {
    query: Object.keys(query).length ? query : undefined,
    mutation: Object.keys(mutation).length ? mutation : undefined,
  };
};

export const summarizeRuntimeError = (error: unknown): RuntimeRequestFailure => {
  if (error instanceof HttpError) {
    return {
      code: `HTTP_${error.statusCode}`,
      message: error.message,
      detail: toAuditJson(error.details ?? null),
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      code: error.code,
      message: error.message,
      detail: toAuditJson(error.meta ?? null),
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      code: 'PRISMA_VALIDATION',
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: error.name || 'Error',
      message: error.message,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Unknown request error',
    detail: toAuditJson(error),
  };
};
