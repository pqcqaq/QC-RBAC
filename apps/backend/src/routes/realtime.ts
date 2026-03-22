import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { emitAuditEvent, emitChatMessage } from '../lib/socket.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/require-permission.js';
import { ok, asyncHandler, parsePagination } from '../utils/http.js';
import { logActivity } from '../utils/audit.js';
import { withSnowflakeId } from '../utils/persistence.js';

const messageSchema = z.object({
  content: z.string().min(1).max(240),
});

const realtimeRouter = Router();

const toLiveMessageDto = (message: {
  id: string;
  senderId: string;
  content: string;
  createdAt: Date;
  sender: {
    nickname: string;
    roles: Array<{ role: { name: string } }>;
  };
}) => ({
  id: message.id,
  senderId: message.senderId,
  senderName: message.sender.nickname,
  senderRoles: message.sender.roles.map(({ role }) => role.name),
  content: message.content,
  createdAt: message.createdAt.toISOString(),
});

realtimeRouter.use(authMiddleware);

realtimeRouter.get(
  '/messages',
  requirePermission('realtime.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = parsePagination(req.query);
    const [total, messages] = await prisma.$transaction([
      prisma.chatMessage.count(),
      prisma.chatMessage.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            include: {
              roles: {
                where: {
                  deleteAt: null,
                },
                include: {
                  role: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return ok(
      res,
      {
        items: messages.reverse().map(toLiveMessageDto),
        meta: { page, pageSize, total },
      },
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
      data: withSnowflakeId({
        senderId: actor.id,
        content: payload.content,
      }),
      include: {
        sender: {
          include: {
            roles: {
              where: {
                deleteAt: null,
              },
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
    const dto = toLiveMessageDto(message);
    emitChatMessage(dto);

    return ok(res, dto, 'Message sent');
  }),
);

export { realtimeRouter };


