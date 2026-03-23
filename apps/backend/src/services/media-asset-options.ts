import type { MediaAssetRecord, PaginatedMediaAssets } from '@rbac/api-common';
import type { Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import type { Prisma } from '../lib/prisma-generated';
import { mediaAssetWithOwnerInclude, toMediaAssetRecord } from '../utils/file-records';
import { parsePaginationInput } from '../utils/http';

type OptionSearchRequest = Pick<Request, 'method' | 'body' | 'query'>;
type MediaAssetSearchInput = Request['query'] | Record<string, unknown> | undefined | null;

export type MediaAssetSearchFilters = {
  q: string;
  kind: string;
  uploadStatus: '' | 'PENDING' | 'COMPLETED' | 'FAILED';
  tag1: string;
  tag2: string;
  mimePrefix: string;
};

type MediaAssetSearchOverrides = {
  defaults?: Partial<MediaAssetSearchFilters>;
  fixed?: Partial<MediaAssetSearchFilters>;
};

const trimText = (value: string | undefined) => value?.trim() ?? '';

const normalizeUploadStatus = (value: string | undefined): MediaAssetSearchFilters['uploadStatus'] => {
  const normalized = trimText(value).toUpperCase();
  return normalized === 'PENDING' || normalized === 'COMPLETED' || normalized === 'FAILED'
    ? normalized
    : '';
};

const mediaAssetSearchSchema = z.object({
  q: z.string().optional().transform(trimText),
  kind: z.string().optional().transform(trimText),
  uploadStatus: z.string().optional().transform(normalizeUploadStatus),
  tag1: z.string().optional().transform(trimText),
  tag2: z.string().optional().transform(trimText),
  mimePrefix: z.string().optional().transform(trimText),
});

const resolveOptionSearchSource = (req: OptionSearchRequest) => {
  const source = req.method === 'GET' ? req.query : req.body;
  return source && typeof source === 'object' ? source : {};
};

const buildResolvedSearchFilters = (
  parsed: z.infer<typeof mediaAssetSearchSchema>,
  overrides?: MediaAssetSearchOverrides,
): MediaAssetSearchFilters => {
  const resolved: MediaAssetSearchFilters = {
    q: '',
    kind: '',
    uploadStatus: '',
    tag1: '',
    tag2: '',
    mimePrefix: '',
  };

  if (overrides?.defaults) {
    Object.assign(resolved, overrides.defaults);
  }

  Object.assign(resolved, parsed);

  if (overrides?.fixed) {
    Object.assign(resolved, overrides.fixed);
  }

  return resolved;
};

const orderResolvedItems = <TItem extends { id: string }>(ids: string[], items: TItem[]) => {
  const itemMap = new Map(items.map((item) => [item.id, item] as const));
  return ids.map((id) => itemMap.get(id)).filter((item): item is TItem => Boolean(item));
};

export const parseMediaAssetSearchFilters = (
  input: MediaAssetSearchInput,
  overrides?: MediaAssetSearchOverrides,
): MediaAssetSearchFilters => {
  const source = input && typeof input === 'object' ? input : {};
  return buildResolvedSearchFilters(mediaAssetSearchSchema.parse(source), overrides);
};

export const parseMediaAssetSearchPayload = (
  req: OptionSearchRequest,
  overrides?: MediaAssetSearchOverrides,
) => {
  const input = resolveOptionSearchSource(req);

  return {
    ...parsePaginationInput(input),
    ...parseMediaAssetSearchFilters(input, overrides),
  };
};

export const buildMediaAssetWhere = ({
  q,
  kind,
  uploadStatus,
  tag1,
  tag2,
  mimePrefix,
}: MediaAssetSearchFilters): Prisma.MediaAssetWhereInput => {
  const andFilters: Prisma.MediaAssetWhereInput[] = [];

  if (q) {
    andFilters.push({
      OR: [
        { originalName: { contains: q, mode: 'insensitive' } },
        { mimeType: { contains: q, mode: 'insensitive' } },
        { objectKey: { contains: q, mode: 'insensitive' } },
        { tag1: { contains: q, mode: 'insensitive' } },
        { tag2: { contains: q, mode: 'insensitive' } },
        {
          user: {
            is: {
              OR: [
                { username: { contains: q, mode: 'insensitive' } },
                { nickname: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    });
  }

  if (kind) {
    andFilters.push({ kind });
  }

  if (uploadStatus) {
    andFilters.push({ uploadStatus });
  }

  if (tag1) {
    andFilters.push({ tag1 });
  }

  if (tag2) {
    andFilters.push({ tag2 });
  }

  if (mimePrefix) {
    andFilters.push({
      mimeType: {
        startsWith: mimePrefix,
        mode: 'insensitive',
      },
    });
  }

  return andFilters.length ? { AND: andFilters } : {};
};

export const listMediaAssets = async ({
  page,
  pageSize,
  skip,
  ...filters
}: ReturnType<typeof parseMediaAssetSearchPayload>): Promise<PaginatedMediaAssets> => {
  const where = buildMediaAssetWhere(filters);
  const [total, assets] = await prisma.$transaction([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.findMany({
      where,
      skip,
      take: pageSize,
      include: mediaAssetWithOwnerInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  return {
    items: assets.map(toMediaAssetRecord),
    meta: { page, pageSize, total },
  };
};

export const resolveMediaAssetsByIds = async (
  ids: string[],
  filters?: Partial<MediaAssetSearchFilters>,
): Promise<MediaAssetRecord[]> => {
  const normalizedIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!normalizedIds.length) {
    return [];
  }

  const where = buildMediaAssetWhere(
    buildResolvedSearchFilters(mediaAssetSearchSchema.parse({}), {
      fixed: filters,
    }),
  );

  const assets = await prisma.mediaAsset.findMany({
    where: {
      AND: [
        { id: { in: normalizedIds } },
        where,
      ],
    },
    include: mediaAssetWithOwnerInclude,
  });

  return orderResolvedItems(normalizedIds, assets).map(toMediaAssetRecord);
};
