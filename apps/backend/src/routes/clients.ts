import { AuthClientType } from '@rbac/api-common';
import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/require-permission.js';
import {
  authClientPayloadSchema,
  parseAuthClientConfig,
} from '../config/auth-clients.js';
import { badRequest, notFound } from '../utils/errors.js';
import { ok, asyncHandler, parsePagination } from '../utils/http.js';
import { publishRbacMutation } from '../utils/rbac-mutation.js';
import { toAuthClientRecord } from '../utils/rbac-records.js';
import { hashSecret } from '../utils/password.js';
import { softDeleteAuthClient } from '../services/rbac-write.js';
import { withSnowflakeId } from '../utils/persistence.js';

const clientsRouter = Router();

clientsRouter.use(authMiddleware);

const resolveClientTarget = (client: { code: string; name: string }) => `${client.name} (${client.code})`;

clientsRouter.get(
  '/',
  requirePermission('client.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const q = String(req.query.q ?? '').trim();
    const type = String(req.query.type ?? '').trim();
    const enabled = String(req.query.enabled ?? '').trim();

    const where: Prisma.AuthClientWhereInput = {};
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (type && Object.values(AuthClientType).includes(type as AuthClientType)) {
      where.type = type as never;
    }
    if (enabled === 'enabled') {
      where.enabled = true;
    }
    if (enabled === 'disabled') {
      where.enabled = false;
    }

    const [total, clients] = await prisma.$transaction([
      prisma.authClient.count({ where }),
      prisma.authClient.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return ok(
      res,
      {
        items: clients.map(toAuthClientRecord),
        meta: { page, pageSize, total },
      },
      'Client list',
    );
  }),
);

clientsRouter.get(
  '/:id',
  requirePermission('client.read'),
  asyncHandler(async (req, res) => {
    const client = await prisma.authClient.findUnique({
      where: { id: String(req.params.id) },
    });

    if (!client) {
      throw notFound('Client not found');
    }

    return ok(res, toAuthClientRecord(client), 'Client detail');
  }),
);

clientsRouter.post(
  '/',
  requirePermission('client.create'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const payload = authClientPayloadSchema.parse(req.body);
    if (!payload.clientSecret) {
      throw badRequest('创建客户端时必须填写 client secret');
    }

    const existing = await prisma.authClient.findUnique({
      where: { code: payload.code },
      select: { id: true },
    });
    if (existing) {
      throw badRequest('Client code already exists');
    }

    const secret = await hashSecret(payload.clientSecret);
    const client = await prisma.authClient.create({
      data: withSnowflakeId({
        code: payload.code,
        name: payload.name,
        type: payload.type,
        description: payload.description ?? null,
        enabled: payload.enabled,
        config: parseAuthClientConfig(payload.type, payload.config) as unknown as Prisma.InputJsonValue,
        secretHash: secret.hash,
        salt: secret.salt,
      }),
    });

    await publishRbacMutation({
      actor,
      action: 'client.create',
      target: resolveClientTarget(client),
    });

    return ok(res, toAuthClientRecord(client), 'Client created');
  }),
);

clientsRouter.put(
  '/:id',
  requirePermission('client.update'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const requestClient = req.authClient!;
    const payload = authClientPayloadSchema.parse(req.body);
    const clientId = String(req.params.id);

    const current = await prisma.authClient.findUnique({
      where: { id: clientId },
    });
    if (!current) {
      throw notFound('Client not found');
    }

    if (current.id === requestClient.id && !payload.enabled) {
      throw badRequest('不能禁用当前请求使用的客户端');
    }

    const updateData: Prisma.AuthClientUpdateInput = {
      code: payload.code,
      name: payload.name,
      type: payload.type,
      description: payload.description ?? null,
      enabled: payload.enabled,
      config: parseAuthClientConfig(payload.type, payload.config) as unknown as Prisma.InputJsonValue,
    };

    if (payload.clientSecret) {
      const secret = await hashSecret(payload.clientSecret);
      updateData.secretHash = secret.hash;
      updateData.salt = secret.salt;
    }

    const client = await prisma.authClient.update({
      where: { id: clientId },
      data: updateData,
    });

    await publishRbacMutation({
      actor,
      action: 'client.update',
      target: resolveClientTarget(client),
      detail: {
        type: payload.type,
        enabled: payload.enabled,
        secretRotated: Boolean(payload.clientSecret),
      },
    });

    return ok(res, toAuthClientRecord(client), 'Client updated');
  }),
);

clientsRouter.delete(
  '/:id',
  requirePermission('client.delete'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const requestClient = req.authClient!;
    const clientId = String(req.params.id);
    const client = await prisma.authClient.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw notFound('Client not found');
    }
    if (client.id === requestClient.id) {
      throw badRequest('不能删除当前请求使用的客户端');
    }

    await softDeleteAuthClient(clientId);
    await publishRbacMutation({
      actor,
      action: 'client.delete',
      target: resolveClientTarget(client),
    });

    return ok(res, { ok: true }, 'Client deleted');
  }),
);

export { clientsRouter };
