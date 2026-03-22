import { env } from '../config/env';
import { defineIntervalTimer } from './timer';
import { reconcilePendingUploads } from './upload-reconcile/reconcile-pending-uploads';

const TIMER_ID = 'upload-reconcile';

export const createUploadReconcileTimer = () =>
  defineIntervalTimer({
    id: TIMER_ID,
    description: 'pending S3 upload reconciliation',
    enabled: env.UPLOAD_RECONCILE_ENABLED,
    runImmediately: env.UPLOAD_RECONCILE_RUN_ON_START,
    schedule: {
      minutes: env.UPLOAD_RECONCILE_INTERVAL_MINUTES,
    },
    async execute() {
      const result = await reconcilePendingUploads();
      console.log(
        `[timer:${TIMER_ID}] checked=${result.checked} completed=${result.completed} failed=${result.failed} pending=${result.pending}`,
      );
    },
  });
