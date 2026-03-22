export const normalizeOptionalText = (value: string) => {
  const normalized = value.trim();
  return normalized || null;
};

export const parseTextareaList = (value: string) =>
  [...new Set(
    value
      .split(/[\r\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )];

export const stringifyTextareaList = (values: string[] | undefined | null) => (values ?? []).join('\n');

export const formatTime = (value: string) => new Date(value).toLocaleString();

export const formatEndpointHost = (value?: string | null) => {
  if (!value) {
    return '未配置';
  }

  try {
    const url = new URL(value);
    return `${url.hostname}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return value;
  }
};
