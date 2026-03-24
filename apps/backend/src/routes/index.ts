import { Router } from 'express';
import { auditRouter } from './audit';
import { authRouter } from './auth';
import { dashboardRouter } from './dashboard';
import { usersRouter } from './users';
import { rolesRouter } from './roles';
import { permissionsRouter } from './permissions';
import { menusRouter } from './menus';
import { filesRouter } from './files';
import { realtimeRouter } from './realtime';
import { clientsRouter } from './clients';
import { attachmentsRouter } from './attachments';
import { oauthManagementRouter } from './oauth';
import { realtimeTopicsRouter } from './realtime-topics';
import { ok } from '../utils/http';

const apiRouter = Router();

apiRouter.get('/health', (_req, res) => ok(res, { status: 'ok' }, 'Service healthy'));
apiRouter.use('/auth', authRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/roles', rolesRouter);
apiRouter.use('/permissions', permissionsRouter);
apiRouter.use('/clients', clientsRouter);
apiRouter.use('/oauth', oauthManagementRouter);
apiRouter.use('/menus', menusRouter);
apiRouter.use('/files', filesRouter);
apiRouter.use('/attachments', attachmentsRouter);
apiRouter.use('/realtime-topics', realtimeTopicsRouter);
apiRouter.use('/realtime', realtimeRouter);

export { apiRouter };

