import { createTimerRegistry } from './timer.js';
import { createUploadReconcileTimer } from './upload-reconcile.timer.js';

export const createBackendTimerRegistry = () =>
  createTimerRegistry([
    createUploadReconcileTimer(),
  ]);
