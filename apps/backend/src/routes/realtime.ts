import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { emitAuditEvent, emitChatMessage } from '../lib/socket.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/require-permission.js';
import { ok, asyncHandler } from '../utils/http.js';
import { logActivity } from '../utils/audit.js';

const messageSchema = z.object({
  content: z.string().min(1).max(240),
});

const realtimeRouter = Router();

realtimeRouter.use(authMiddleware);

realtimeRouter.get(
  '/messages',
  requirePermission('realtime.read'),
  asyncHandler(async (_req, res) => {
    const messages = await prisma.chatMessage.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    return ok(
      res,
      messages
        .reverse()
        .map((message) => ({
          id: message.id,
          senderId: message.senderId,
          senderName: message.sender.nickname,
          senderRoles: message.sender.roles.map(({ role }) => role.name),
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        })),
      'Message history',
    );
  }),
);

realtimeRouter.post(
  '/messages',
  requirePermission('realtime.send'),
  asyncHandler(async (req, res) => {
    const actor = req.auth!;
    const payload = messageSchema.parse(req.body);
    const message = await prisma.chatMessage.create({
      data: {
        senderId: actor.id,
        content: payload.content,
      },
      include: {
        sender: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.nickname,
      action: 'realtime.send',
      target: 'global-channel',
      detail: { content: payload.content },
    });
    emitAuditEvent({ action: 'realtime.send', actor: actor.nickname, target: 'global-channel' });
    const dto = {
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender.nickname,
      senderRoles: message.sender.roles.map(({ role }) => role.name),
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
    emitChatMessage(dto);

    return ok(
      res,
      {
        id: message.id,
        senderId: message.senderId,
        senderName: message.sender.nickname,
        senderRoles: message.sender.roles.map(({ role }) => role.name),
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
      'Message sent',
    );
  }),
);

export { realtimeRouter };


