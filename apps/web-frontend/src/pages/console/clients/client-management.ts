import {
  AuthClientType,
  type AuthClientFormPayload,
  type AuthClientRecord,
} from '@rbac/api-common';

export type ClientEditorConfigForm = {
  protocol: 'http' | 'https';
  host: string;
  port: string;
  appId: string;
  appSecret: string;
  packageName: string;
  platform: string;
};

export type ClientEditorForm = {
  code: string;
  name: string;
  type: AuthClientType;
  description: string;
  enabled: boolean;
  clientSecret: string;
  config: ClientEditorConfigForm;
};

export const createEmptyClientEditorForm = (): ClientEditorForm => ({
  code: '',
  name: '',
  type: AuthClientType.WEB,
  description: '',
  enabled: true,
  clientSecret: '',
  config: {
    protocol: 'http',
    host: '',
    port: '',
    appId: '',
    appSecret: '',
    packageName: '',
    platform: '',
  },
});

const resetConfigForm = (config: ClientEditorConfigForm) => {
  config.protocol = 'http';
  config.host = '';
  config.port = '';
  config.appId = '';
  config.appSecret = '';
  config.packageName = '';
  config.platform = '';
};

export const assignClientEditorForm = (form: ClientEditorForm, record: AuthClientRecord) => {
  form.code = record.code;
  form.name = record.name;
  form.type = record.type;
  form.description = record.description ?? '';
  form.enabled = record.enabled;
  form.clientSecret = '';
  resetConfigForm(form.config);

  if (record.type === AuthClientType.WEB) {
    form.config.protocol = record.config.protocol;
    form.config.host = record.config.host;
    form.config.port = record.config.port ? String(record.config.port) : '';
    return;
  }

  if (record.type === AuthClientType.UNI_WECHAT_MINIAPP) {
    form.config.appId = record.config.appId;
    form.config.appSecret = record.config.appSecret;
    return;
  }

  form.config.packageName = record.config.packageName;
  form.config.platform = record.config.platform ?? '';
};

export const buildClientPayload = (form: ClientEditorForm): AuthClientFormPayload => {
  const basePayload = {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim() || null,
    enabled: form.enabled,
    clientSecret: form.clientSecret.trim() || undefined,
  };

  if (form.type === AuthClientType.WEB) {
    return {
      ...basePayload,
      type: AuthClientType.WEB,
      config: {
        protocol: form.config.protocol,
        host: form.config.host.trim(),
        port: form.config.port.trim() ? Number(form.config.port.trim()) : null,
      },
    };
  }

  if (form.type === AuthClientType.UNI_WECHAT_MINIAPP) {
    return {
      ...basePayload,
      type: AuthClientType.UNI_WECHAT_MINIAPP,
      config: {
        appId: form.config.appId.trim(),
        appSecret: form.config.appSecret.trim(),
      },
    };
  }

  return {
    ...basePayload,
    type: AuthClientType.APP,
    config: {
      packageName: form.config.packageName.trim(),
      platform: form.config.platform.trim() || undefined,
    },
  };
};

export const validateClientForm = (form: ClientEditorForm, editingId: string | null) => {
  if (!form.code.trim() || !form.name.trim()) {
    return '请完整填写客户端编码和名称';
  }

  if (!editingId && !form.clientSecret.trim()) {
    return '创建客户端时必须填写 client secret';
  }

  if (form.type === AuthClientType.WEB) {
    if (!form.config.host.trim()) {
      return 'Web 客户端必须填写 Host';
    }

    if (form.config.port.trim() && Number.isNaN(Number(form.config.port.trim()))) {
      return 'Web 客户端端口必须是数字';
    }
  }

  if (form.type === AuthClientType.UNI_WECHAT_MINIAPP) {
    if (!form.config.appId.trim() || !form.config.appSecret.trim()) {
      return '小程序客户端必须填写 AppID 和 AppSecret';
    }
  }

  if (form.type === AuthClientType.APP && !form.config.packageName.trim()) {
    return 'App 客户端必须填写包名';
  }

  return undefined;
};

export const resolveClientTypeLabel = (type: AuthClientType) => {
  if (type === AuthClientType.WEB) {
    return 'Web';
  }

  if (type === AuthClientType.UNI_WECHAT_MINIAPP) {
    return '微信小程序';
  }

  return 'App';
};

export const buildClientConfigEntries = (client: AuthClientRecord) => {
  if (client.type === AuthClientType.WEB) {
    return [
      { label: '协议', value: client.config.protocol.toUpperCase() },
      { label: '域名', value: client.config.host },
      { label: '端口', value: client.config.port ? String(client.config.port) : '默认' },
    ];
  }

  if (client.type === AuthClientType.UNI_WECHAT_MINIAPP) {
    return [
      { label: 'AppID', value: client.config.appId },
      { label: 'AppSecret', value: client.config.appSecret },
    ];
  }

  return [
    { label: '包名', value: client.config.packageName },
    { label: '平台', value: client.config.platform || '未指定' },
  ];
};

export const formatClientConfigSummary = (client: AuthClientRecord) => {
  if (client.type === AuthClientType.WEB) {
    const port = client.config.port ? `:${client.config.port}` : '';
    return `${client.config.protocol}://${client.config.host}${port}`;
  }

  if (client.type === AuthClientType.UNI_WECHAT_MINIAPP) {
    return `AppID: ${client.config.appId}`;
  }

  return client.config.platform
    ? `${client.config.packageName} · ${client.config.platform}`
    : client.config.packageName;
};
