import type { WsAdaptor, WsConnectOptions } from '../client';

export const createWebWsAdaptor = (): WsAdaptor => ({
  connect({
    onClose,
    onError,
    onMessage,
    onOpen,
    protocols,
    url,
  }: WsConnectOptions) {
    const socket = protocols?.length
      ? new WebSocket(url, protocols)
      : new WebSocket(url);

    socket.addEventListener('open', onOpen);
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        onError(new Error('Realtime client only supports text frames'));
        return;
      }

      onMessage(event.data);
    });
    socket.addEventListener('error', (event) => {
      onError(new Error(`WebSocket error: ${String(event.type)}`));
    });
    socket.addEventListener('close', (event) => {
      onClose({
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
    });

    return {
      close(code, reason) {
        socket.close(code, reason);
      },
      send(data) {
        if (socket.readyState !== WebSocket.OPEN) {
          return Promise.reject(new Error('WebSocket is not open'));
        }

        socket.send(data);
        return Promise.resolve();
      },
    };
  },
});
