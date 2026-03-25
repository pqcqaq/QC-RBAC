import type {
  BackendRuntimeContext,
  BackendRuntimeRawDbClient,
} from '../lib/backend-runtime-context';
import type { PrismaClient } from '../lib/prisma-generated';
import type { RuntimeOperationAccessKind } from '../lib/request-audit';

export type TriggerAction = 'select' | 'update' | 'delete';
export type TriggerTiming = 'before' | 'after';
export type TriggerDeleteMode = 'soft' | 'hard' | null;
export type TriggerArgs = Record<string, unknown>;
export type TriggerRecord = Record<string, unknown>;

export type BackendTriggerContext = {
  entity: string;
  action: TriggerAction;
  when: TriggerTiming;
  operation: string;
  effectiveOperation: string;
  accessKind: RuntimeOperationAccessKind;
  deleteMode: TriggerDeleteMode;
  runtime: BackendRuntimeContext | null;
  db: PrismaClient;
  dbRaw: PrismaClient;
  dbDriver: BackendRuntimeRawDbClient;
  requestedArgs: TriggerArgs;
  effectiveArgs: TriggerArgs;
  filter: unknown;
  data: unknown;
  result: unknown;
  beforeRows: TriggerRecord[];
  afterRows: TriggerRecord[];
};

export type BackendTriggerDefinition = {
  name?: string;
  entity: string;
  action: TriggerAction;
  when: TriggerTiming;
  fn: (context: BackendTriggerContext) => Promise<void> | void;
};

export type BeforeTriggerDefinition = BackendTriggerDefinition & {
  when: 'before';
};

export type AfterTriggerDefinition = BackendTriggerDefinition & {
  when: 'after';
};

export const defineBeforeTrigger = (
  input: Omit<BeforeTriggerDefinition, 'when'>,
): BeforeTriggerDefinition => ({
  ...input,
  when: 'before',
});

export const defineAfterTrigger = (
  input: Omit<AfterTriggerDefinition, 'when'>,
): AfterTriggerDefinition => ({
  ...input,
  when: 'after',
});
