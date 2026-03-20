import { Router } from 'express';
import { auditRouter } from './audit.js';
import { authRouter } from './auth.js';
import { dashboardRouter } from './dashboard.js';
import { usersRouter } from './users.js';
import { rolesRouter } from './roles.js';
import { permissionsRouter } from './permissions.js';
import { filesRouter } from './files.js';
import { realtimeRouter } from './realtime.js';
import { ok } from '../utils/http.js';

const apiRouter = Router();

apiRouter.get('/health', (_req, res) => ok(res, { status: 'ok' }, 'Service healthy'));
apiRouter.use('/auth', authRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/roles', rolesRouter);
apiRouter.use('/permissions', permissionsRouter);
apiRouter.use('/files', filesRouter);
apiRouter.use('/realtime', realtimeRouter);

export { apiRouter };
