import type { PrismaClient } from '../lib/prisma-generated';
import {
  buildMediaAssetCleanupTriggers,
  createMediaAssetStorageCleanupTrigger,
} from './attachment-cleanup';
import type {
  BackendTriggerDefinition,
  TriggerAction,
  TriggerTiming,
} from './types';

export type BackendTriggerRegistry = {
  before: Map<string, BackendTriggerDefinition[]>;
  after: Map<string, BackendTriggerDefinition[]>;
};

const buildRegistryKey = (entity: string, action: TriggerAction) => `${entity}:${action}`;

const pushTrigger = (
  bucket: Map<string, BackendTriggerDefinition[]>,
  trigger: BackendTriggerDefinition,
) => {
  const key = buildRegistryKey(trigger.entity, trigger.action);
  const current = bucket.get(key) ?? [];
  current.push(trigger);
  bucket.set(key, current);
};

export const buildBackendTriggerRegistry = (
  client: PrismaClient,
): BackendTriggerRegistry => {
  const registry: BackendTriggerRegistry = {
    before: new Map(),
    after: new Map(),
  };

  const definitions: BackendTriggerDefinition[] = [
    createMediaAssetStorageCleanupTrigger(),
    ...buildMediaAssetCleanupTriggers(client),
  ];

  definitions.forEach((trigger) => {
    pushTrigger(trigger.when === 'before' ? registry.before : registry.after, trigger);
  });

  return registry;
};

export const getTriggersForOperation = (
  registry: BackendTriggerRegistry,
  when: TriggerTiming,
  entity: string,
  action: TriggerAction,
) => {
  const bucket = when === 'before' ? registry.before : registry.after;
  return bucket.get(buildRegistryKey(entity, action)) ?? [];
};
