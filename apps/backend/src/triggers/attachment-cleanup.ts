import type {
  MediaAssetStorageProvider,
  MediaAssetUploadStrategy,
  PrismaClient,
} from '../lib/prisma-generated';
import {
  buildPrismaEntityRelationGraph,
  type PrismaEntityRelationGraph,
} from '../lib/entity-relation-graph';
import { deleteStoredUpload } from '../services/file-upload';
import { HttpError } from '../utils/errors';
import {
  defineAfterTrigger,
  type AfterTriggerDefinition,
  type BackendTriggerContext,
  type TriggerRecord,
} from './types';

type MediaAssetCleanupSpec = {
  entity: string;
  sourceField: string;
  relationName: string | null;
  fromField: string;
};

type MediaAssetStorageRecord = {
  id: string;
  objectKey: string;
  storageProvider: MediaAssetStorageProvider;
  storageBucket: string;
  uploadStrategy: MediaAssetUploadStrategy;
  chunkCount: number | null;
};

const uniqueStrings = (values: string[]) => [...new Set(values)];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const resolveStorageProvider = (value: unknown): MediaAssetStorageProvider | null =>
  value === 'LOCAL' || value === 'S3' ? value : null;

const resolveUploadStrategy = (value: unknown): MediaAssetUploadStrategy | null =>
  value === 'SINGLE' || value === 'CHUNKED' ? value : null;

const toMediaAssetStorageRecord = (row: TriggerRecord): MediaAssetStorageRecord | null => {
  const id = typeof row.id === 'string' ? row.id : null;
  const objectKey = typeof row.objectKey === 'string' ? row.objectKey : null;
  const storageProvider = resolveStorageProvider(row.storageProvider);
  const storageBucket = typeof row.storageBucket === 'string' ? row.storageBucket : null;
  const uploadStrategy = resolveUploadStrategy(row.uploadStrategy);
  const chunkCount = typeof row.chunkCount === 'number'
    ? row.chunkCount
    : row.chunkCount == null
      ? null
      : null;

  if (!id || !objectKey || !storageProvider || !storageBucket || !uploadStrategy) {
    return null;
  }

  return {
    id,
    objectKey,
    storageProvider,
    storageBucket,
    uploadStrategy,
    chunkCount,
  };
};

const scheduleStoredUploadCleanup = async (
  context: BackendTriggerContext,
  records: MediaAssetStorageRecord[],
) => {
  if (!records.length) {
    return;
  }

  const runCleanup = async () => {
    for (const record of records) {
      await deleteStoredUpload({
        fileId: record.id,
        objectKey: record.objectKey,
        storageProvider: record.storageProvider,
        storageBucket: record.storageBucket,
        uploadStrategy: record.uploadStrategy,
        chunkCount: record.chunkCount,
      });
    }
  };

  if (context.runtime?.inTransaction) {
    context.runtime.deferPostCommitTask(runCleanup);
    return;
  }

  await runCleanup();
};

const dedupeMediaAssetStorageRecords = (records: MediaAssetStorageRecord[]) => {
  const byId = new Map<string, MediaAssetStorageRecord>();
  records.forEach((record) => {
    byId.set(record.id, record);
  });
  return [...byId.values()];
};

const deleteRelatedMediaAssets = async (
  context: BackendTriggerContext,
  assetIds: string[],
) => {
  for (const assetId of assetIds) {
    try {
      await context.db.mediaAsset.delete({
        where: { id: assetId },
      });
    } catch (error) {
      const details = error instanceof HttpError && isPlainObject(error.details)
        ? error.details
        : null;
      const isReferenceBlocked = error instanceof HttpError
        && error.statusCode === 400
        && details?.model === 'MediaAsset';

      if (isReferenceBlocked) {
        continue;
      }

      throw error;
    }
  }
};

export const resolveMediaAssetCleanupSpecs = (
  graph: PrismaEntityRelationGraph,
): MediaAssetCleanupSpec[] =>
  graph.edges
    .filter((edge) =>
      edge.targetModel === 'MediaAsset'
      && edge.sourceModel !== 'MediaAsset'
      && edge.fromFields.length === 1
      && edge.toFields.length === 1
      && edge.toFields[0] === 'id')
    .map((edge) => ({
      entity: edge.sourceModel,
      sourceField: edge.sourceField,
      relationName: edge.relationName,
      fromField: edge.fromFields[0]!,
    }));

const collectReferencedMediaAssetIds = (
  rows: TriggerRecord[],
  spec: MediaAssetCleanupSpec,
) =>
  uniqueStrings(
    rows
      .map((row) => row[spec.fromField])
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );

export const createMediaAssetStorageCleanupTrigger = (): AfterTriggerDefinition =>
  defineAfterTrigger({
    name: 'cleanup-media-asset-storage',
    entity: 'MediaAsset',
    action: 'delete',
    fn: async (context) => {
      const records = dedupeMediaAssetStorageRecords(
        context.beforeRows
          .map((row) => toMediaAssetStorageRecord(row))
          .filter((row): row is MediaAssetStorageRecord => Boolean(row)),
      );

      await scheduleStoredUploadCleanup(context, records);
    },
  });

export const buildMediaAssetCleanupTriggers = (
  client: PrismaClient,
): AfterTriggerDefinition[] => {
  const graph = buildPrismaEntityRelationGraph(client);
  if (!graph) {
    return [];
  }

  return resolveMediaAssetCleanupSpecs(graph).map((spec) =>
    defineAfterTrigger({
      name: `cleanup-media-asset:${spec.entity}.${spec.sourceField}`,
      entity: spec.entity,
      action: 'delete',
      fn: async (context) => {
        const assetIds = collectReferencedMediaAssetIds(context.beforeRows, spec);
        await deleteRelatedMediaAssets(context, assetIds);
      },
    }));
};
