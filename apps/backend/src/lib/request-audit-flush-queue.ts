let requestAuditFlushQueue: Promise<void> = Promise.resolve();

const settleQueue = (task: Promise<void>) => task.catch(() => undefined);

export const enqueueRequestAuditFlush = (task: () => Promise<void>) => {
  const nextTask = settleQueue(requestAuditFlushQueue).then(task);
  requestAuditFlushQueue = settleQueue(nextTask);
  return nextTask;
};

export const waitForPendingRequestAuditFlushes = () => requestAuditFlushQueue;
