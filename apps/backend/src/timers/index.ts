import { createTimerRegistry } from './timer';
import { createOAuthUpstreamRefreshTimer } from './oauth-upstream-refresh.timer';
import { createUploadReconcileTimer } from './upload-reconcile.timer';

export const createBackendTimerRegistry = () =>
  createTimerRegistry([
    createOAuthUpstreamRefreshTimer(),
    createUploadReconcileTimer(),
  ]);
