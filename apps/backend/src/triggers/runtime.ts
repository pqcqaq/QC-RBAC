import type { TriggerAction, TriggerArgs, TriggerDeleteMode } from './types';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getDeleteAtWriteValue = (data?: unknown) => {
  if (!isPlainObject(data) || !Object.prototype.hasOwnProperty.call(data, 'deleteAt')) {
    return undefined;
  }

  const value = data.deleteAt;
  if (isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, 'set')) {
    return value.set;
  }

  return value;
};

export const resolveTriggerAction = (
  operation: string,
  requestedArgs: TriggerArgs,
): TriggerAction | null => {
  if (
    operation === 'findUnique'
    || operation === 'findFirst'
    || operation === 'findMany'
    || operation === 'count'
    || operation === 'aggregate'
  ) {
    return 'select';
  }

  if (operation === 'delete' || operation === 'deleteMany') {
    return 'delete';
  }

  if (
    (operation === 'update' || operation === 'updateMany')
    && getDeleteAtWriteValue(requestedArgs.data) != null
  ) {
    return 'delete';
  }

  if (operation === 'update' || operation === 'updateMany') {
    return 'update';
  }

  return null;
};

export const resolveTriggerDeleteMode = (
  operation: string,
  requestedArgs: TriggerArgs,
  softDelete: boolean,
): TriggerDeleteMode => {
  if (operation === 'delete' || operation === 'deleteMany') {
    return softDelete ? 'soft' : 'hard';
  }

  if (
    (operation === 'update' || operation === 'updateMany')
    && getDeleteAtWriteValue(requestedArgs.data) != null
  ) {
    return 'soft';
  }

  return null;
};
