import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = {
  actorId: string | null;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(
  context: RequestContext,
  callback: () => T,
) => requestContextStorage.run(context, callback);

export const getRequestContext = () => requestContextStorage.getStore() ?? null;

export const getRequestActorId = () => getRequestContext()?.actorId ?? null;

export const setRequestActorId = (actorId: string | null) => {
  const store = requestContextStorage.getStore();
  if (store) {
    store.actorId = actorId;
  }
};
