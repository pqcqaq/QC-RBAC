import { purgeExpiredRequestAudits } from '../services/request-audit';
import { defineCronTimer } from './timer';

const TIMER_ID = 'request-audit-retention';

export const createRequestAuditRetentionTimer = () =>
  defineCronTimer({
    id: TIMER_ID,
    description: '清理 30 天之前的请求审计记录',
    enabled: true,
    schedule: {
      cronExpression: '0 0 * * *',
      timezone: process.env.TZ || 'Asia/Shanghai',
    },
    async execute() {
      const result = await purgeExpiredRequestAudits(30);
      console.log(
        `[timer:${TIMER_ID}] deleted=${result.deleted} cutoff=${result.cutoff.toISOString()}`,
      );
    },
  });
