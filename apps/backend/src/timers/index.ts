import { createTimerRegistry } from './timer';
import { createOAuthUpstreamRefreshTimer } from './oauth-upstream-refresh.timer';
import { createRequestAuditRetentionTimer } from './request-audit-retention.timer';
import { createUploadReconcileTimer } from './upload-reconcile.timer';

export const createBackendTimerRegistry = () =>
  createTimerRegistry([
    createOAuthUpstreamRefreshTimer(),
    createRequestAuditRetentionTimer(),
    createUploadReconcileTimer(),
  ]);
