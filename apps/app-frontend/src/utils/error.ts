const isErrorWithMessage = (error: unknown): error is { message: string } =>
  typeof error === 'object'
  && error !== null
  && typeof Reflect.get(error, 'message') === 'string'

export function getErrorMessage(error: unknown, fallback: string) {
  if (isErrorWithMessage(error)) {
    const message = error.message.trim()
    return message || fallback
  }

  return fallback
}
