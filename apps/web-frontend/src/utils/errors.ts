const isErrorWithMessage = (error: unknown): error is { message: string } =>
  typeof error === 'object'
  && error !== null
  && typeof Reflect.get(error, 'message') === 'string';

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (isErrorWithMessage(error)) {
    const message = error.message.trim();
    return message || fallback;
  }

  return fallback;
};

export const isDialogCancellation = (error: unknown): error is 'cancel' | 'close' =>
  error === 'cancel' || error === 'close';
