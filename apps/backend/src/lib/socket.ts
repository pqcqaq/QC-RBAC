import type { Server as HttpServer } from 'http';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import { clientOrigins } from '../config/env';
import { prisma } from './prisma';
import { withSnowflakeId } from '../utils/persistence';
import { runWithRequestContext } from '../utils/request-context';
import { buildCurrentUser } from '../utils/rbac';
import { verifyAccessToken } from '../utils/token';

type RealtimeUser = Awaited<ReturnType<typeof buildCurrentUser>>;

let io: Server | null = null;

const extractToken = (socket: Socket) => {
  const authToken = socket.handshake.auth.token;
  if (typeof authToken === 'string' && authToken) {
    return authToken.startsWith('Bearer ') ? authToken.slice(7) : authToken;
  }

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header) {
    return header.startsWith('Bearer ') ? header.slice(7) : header;
  }

  return null;
};

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: clientOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) {
        throw new Error('Missing token');
      }
      const payload = verifyAccessToken(token);
      const user = await buildCurrentUser(payload.sub);
      socket.data.user = user;
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as RealtimeUser;
    socket.join('global');
    socket.join(`user:${user.id}`);

    io?.to('global').emit('presence:changed', {
      userId: user.id,
      nickname: user.nickname,
      status: 'online',
      at: new Date().toISOString(),
    });

    socket.on('chat:send', async (content: string) => {
      const currentUser = socket.data.user as RealtimeUser;
      if (!currentUser.permissions.includes('realtime.send')) {
        socket.emit('chat:error', { message: 'Missing permission: realtime.send' });
        return;
      }

      await runWithRequestContext({ actorId: currentUser.id }, async () => {
        const message = await prisma.chatMessage.create({
          data: withSnowflakeId({
            senderId: currentUser.id,
            content,
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

        io?.to('global').emit('chat:new', {
          id: message.id,
          senderId: message.senderId,
          senderName: message.sender.nickname,
          senderRoles: message.sender.roles.map(({ role }) => role.name),
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        });
      });
    });

    socket.on('disconnect', () => {
      io?.to('global').emit('presence:changed', {
        userId: user.id,
        nickname: user.nickname,
        status: 'offline',
        at: new Date().toISOString(),
      });
    });
  });

  return io;
};

export const emitAuditEvent = (payload: {
  action: string;
  actor: string;
  target: string;
  createdAt?: string;
}) => {
  io?.to('global').emit('audit:event', {
    ...payload,
    createdAt: payload.createdAt ?? new Date().toISOString(),
  });
};

export const emitRbacUpdated = (userIds: string[], reason: string) => {
  userIds.forEach((userId) => {
    io?.to(`user:${userId}`).emit('rbac:updated', {
      reason,
      at: new Date().toISOString(),
    });
  });
};

export const emitChatMessage = (message: {
  id: string;
  senderId: string;
  senderName: string;
  senderRoles: string[];
  content: string;
  createdAt: string;
}) => {
  io?.to('global').emit('chat:new', message);
};

