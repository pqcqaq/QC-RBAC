import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { emitAuditEvent, emitChatMessage } from '../lib/socket';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/require-permission';
import { ok, asyncHandler, parsePagination } from '../utils/http';
import { logActivity } from '../utils/audit';
import { withSnowflakeId } from '../utils/persistence';
import { createExcelExportHandler, createTimestampedExcelFileName } from '../utils/excel-export';

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

const liveMessageInclude = {
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
} as const;

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
        include: liveMessageInclude,
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

realtimeRouter.get(
  '/messages/export',
  requirePermission('realtime.read'),
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('live-messages'),
    sheetName: 'Live Messages',
    parseQuery: () => ({}),
    queryRows: async () =>
      prisma.chatMessage.findMany({
        orderBy: { createdAt: 'asc' },
        include: liveMessageInclude,
      }),
    columns: [
      { header: '发送人', width: 18, value: (row) => row.sender.nickname },
      { header: '角色', width: 26, value: (row) => row.sender.roles.map(({ role }) => role.name).join(' / ') },
      { header: '消息内容', width: 48, value: (row) => row.content },
      { header: '发送时间', width: 22, value: (row) => row.createdAt },
    ],
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
      include: liveMessageInclude,
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


