import type { WsAdaptor, WsConnectOptions } from '../client';

type UniSocketTask = {
  close(options?: {
    code?: number;
    reason?: string;
    success?: () => void;
    fail?: (error: unknown) => void;
  }): void;
  onClose(callback: (result: { code?: number; reason?: string }) => void): void;
  onError(callback: (error: unknown) => void): void;
  onMessage(callback: (result: { data: string | ArrayBuffer }) => void): void;
  onOpen(callback: () => void): void;
  send(options: {
    data: string;
    success?: () => void;
    fail?: (error: unknown) => void;
  }): void;
};

declare const uni: {
  connectSocket(options: {
    header?: Record<string, string>;
    protocols?: string[];
    url: string;
  }): UniSocketTask;
};

export const createUniWsAdaptor = (): WsAdaptor => ({
  connect({
    headers,
    onClose,
    onError,
    onMessage,
    onOpen,
    protocols,
    url,
  }: WsConnectOptions) {
    const socketTask = uni.connectSocket({
      ...(headers ? { header: headers } : {}),
      ...(protocols?.length ? { protocols } : {}),
      url,
    });

    socketTask.onOpen(onOpen);
    socketTask.onError(onError);
    socketTask.onClose((result) => {
      onClose({
        code: result.code,
        reason: result.reason,
      });
    });
    socketTask.onMessage((result) => {
      if (typeof result.data !== 'string') {
        onError(new Error('Realtime client only supports text frames'));
        return;
      }

      onMessage(result.data);
    });

    return {
      close(code, reason) {
        socketTask.close({
          ...(code === undefined ? {} : { code }),
          ...(reason === undefined ? {} : { reason }),
          fail: onError,
        });
      },
      send(data) {
        return new Promise<void>((resolve, reject) => {
          socketTask.send({
            data,
            fail: reject,
            success: resolve,
          });
        });
      },
    };
  },
});
