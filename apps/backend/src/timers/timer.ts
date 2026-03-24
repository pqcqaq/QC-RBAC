import {
  AsyncTask,
  CronJob,
  type CronSchedule,
  SimpleIntervalJob,
  type SimpleIntervalSchedule,
  ToadScheduler,
} from 'toad-scheduler';

type IntervalSchedule = Omit<SimpleIntervalSchedule, 'runImmediately'>;

type TimerSchedule =
  | {
      kind: 'interval';
      options: IntervalSchedule;
    }
  | {
      kind: 'cron';
      options: CronSchedule;
    };

export interface IntervalTimerDefinition {
  id: string;
  description: string;
  enabled: boolean;
  schedule: TimerSchedule;
  runImmediately?: boolean;
  execute: () => Promise<void>;
}

export interface TimerRegistry {
  start: () => void;
  stop: () => void;
}

const formatIntervalSchedule = (schedule: IntervalSchedule) => {
  const parts = Object.entries(schedule)
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .map(([unit, value]) => `${value}${unit}`);

  return parts.join(' ') || 'manual';
};

const formatSchedule = (schedule: TimerSchedule) =>
  schedule.kind === 'cron'
    ? `cron:${schedule.options.cronExpression}${schedule.options.timezone ? ` tz=${schedule.options.timezone}` : ''}`
    : formatIntervalSchedule(schedule.options);

export const defineIntervalTimer = (
  timer: Omit<IntervalTimerDefinition, 'schedule'> & {
    schedule: IntervalSchedule;
  },
): IntervalTimerDefinition => ({
  ...timer,
  schedule: {
    kind: 'interval',
    options: timer.schedule,
  },
});

export const defineCronTimer = (
  timer: Omit<IntervalTimerDefinition, 'schedule' | 'runImmediately'> & {
    schedule: CronSchedule;
  },
): IntervalTimerDefinition => ({
  ...timer,
  schedule: {
    kind: 'cron',
    options: timer.schedule,
  },
});

export const createTimerRegistry = (timers: IntervalTimerDefinition[]): TimerRegistry => {
  const scheduler = new ToadScheduler();
  let started = false;
  let activeTimerIds: string[] = [];

  return {
    start() {
      if (started) {
        return;
      }

      started = true;
      activeTimerIds = [];

      for (const timer of timers) {
        if (!timer.enabled) {
          console.log(`[timer:${timer.id}] disabled`);
          continue;
        }

        let running = false;
        const task = new AsyncTask(
          timer.id,
          async () => {
            if (running) {
              console.log(`[timer:${timer.id}] skip tick: previous run still running`);
              return;
            }

            running = true;
            const startedAt = Date.now();

            try {
              await timer.execute();
              console.log(`[timer:${timer.id}] completed in ${Date.now() - startedAt}ms`);
            } finally {
              running = false;
            }
          },
          (error) => {
            console.error(`[timer:${timer.id}] failed`, error);
          },
        );

        if (timer.schedule.kind === 'cron') {
          scheduler.addCronJob(
            new CronJob(
              timer.schedule.options,
              task,
              {
                id: timer.id,
                preventOverrun: true,
              },
            ),
          );
        } else {
          scheduler.addSimpleIntervalJob(
            new SimpleIntervalJob(
              {
                ...timer.schedule.options,
                runImmediately: timer.runImmediately ?? false,
              },
              task,
              {
                id: timer.id,
                preventOverrun: true,
              },
            ),
          );
        }

        activeTimerIds.push(timer.id);
        console.log(
          `[timer:${timer.id}] scheduled ${formatSchedule(timer.schedule)} runImmediately=${timer.runImmediately ?? false} ${timer.description}`,
        );
      }
    },

    stop() {
      if (!started) {
        return;
      }

      scheduler.stop();
      started = false;

      if (activeTimerIds.length > 0) {
        console.log(`[timer] stopped ${activeTimerIds.join(', ')}`);
      }

      activeTimerIds = [];
    },
  };
};
