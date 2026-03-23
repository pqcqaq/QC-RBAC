export const resolveRealtimeWsUrl = (baseUrl: string, path = '/realtime/ws') => {
  const fallbackBase = typeof location !== 'undefined' ? location.origin : 'http://localhost';
  const url = new URL(baseUrl, fallbackBase);

  if (url.protocol === 'http:') {
    url.protocol = 'ws:';
  } else if (url.protocol === 'https:') {
    url.protocol = 'wss:';
  }

  const basePath = url.pathname.replace(/\/api\/?$/, '') || '/';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  url.pathname = `${basePath === '/' ? '' : basePath}${normalizedPath}`.replace(/\/+/g, '/');
  url.search = '';

  return url.toString();
};
