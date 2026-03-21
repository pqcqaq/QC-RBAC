import {
  AsyncTask,
  SimpleIntervalJob,
  type SimpleIntervalSchedule,
  ToadScheduler,
} from 'toad-scheduler';

type IntervalSchedule = Omit<SimpleIntervalSchedule, 'runImmediately'>;

export interface IntervalTimerDefinition {
  id: string;
  description: string;
  enabled: boolean;
  schedule: IntervalSchedule;
  runImmediately?: boolean;
  execute: () => Promise<void>;
}

export interface TimerRegistry {
  start: () => void;
  stop: () => void;
}

const formatSchedule = (schedule: IntervalSchedule) => {
  const parts = Object.entries(schedule)
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .map(([unit, value]) => `${value}${unit}`);

  return parts.join(' ') || 'manual';
};

export const defineIntervalTimer = (timer: IntervalTimerDefinition) => timer;

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

        scheduler.addSimpleIntervalJob(
          new SimpleIntervalJob(
            {
              ...timer.schedule,
              runImmediately: timer.runImmediately ?? false,
            },
            task,
            {
              id: timer.id,
            },
          ),
        );

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
