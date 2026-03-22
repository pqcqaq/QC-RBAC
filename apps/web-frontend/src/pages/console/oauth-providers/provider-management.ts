import type {
  OAuthProviderClientAuthMethod,
  OAuthProviderFormPayload,
  OAuthProviderProtocol,
  OAuthProviderRecord,
} from '@rbac/api-common';
import {
  formatEndpointHost,
  normalizeOptionalText,
  parseTextareaList,
  stringifyTextareaList,
} from '../oauth/oauth-management';

type ProviderClaimMappingForm = {
  subject: string;
  email: string;
  username: string;
  nickname: string;
  avatarUrl: string;
};

export type OAuthProviderEditorForm = {
  code: string;
  name: string;
  description: string;
  logoUrl: string;
  protocol: OAuthProviderProtocol;
  issuer: string;
  discoveryUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  jwksUri: string;
  clientId: string;
  clientSecret: string;
  defaultScopesText: string;
  enabled: boolean;
  allowLogin: boolean;
  autoRegister: boolean;
  autoLinkByEmail: boolean;
  usePkce: boolean;
  clientAuthMethod: OAuthProviderClientAuthMethod;
  claimMapping: ProviderClaimMappingForm;
};

const createEmptyClaimMapping = (): ProviderClaimMappingForm => ({
  subject: 'sub',
  email: 'email',
  username: 'preferred_username',
  nickname: 'name',
  avatarUrl: 'picture',
});

export const createEmptyOAuthProviderEditorForm = (): OAuthProviderEditorForm => ({
  code: '',
  name: '',
  description: '',
  logoUrl: '',
  protocol: 'OIDC',
  issuer: '',
  discoveryUrl: '',
  authorizationEndpoint: '',
  tokenEndpoint: '',
  userinfoEndpoint: '',
  jwksUri: '',
  clientId: '',
  clientSecret: '',
  defaultScopesText: 'openid\nprofile\nemail\noffline_access',
  enabled: true,
  allowLogin: true,
  autoRegister: true,
  autoLinkByEmail: true,
  usePkce: true,
  clientAuthMethod: 'CLIENT_SECRET_BASIC',
  claimMapping: createEmptyClaimMapping(),
});

export const assignOAuthProviderEditorForm = (
  form: OAuthProviderEditorForm,
  record: OAuthProviderRecord,
) => {
  form.code = record.code;
  form.name = record.name;
  form.description = record.description ?? '';
  form.logoUrl = record.logoUrl ?? '';
  form.protocol = record.protocol;
  form.issuer = record.issuer ?? '';
  form.discoveryUrl = record.discoveryUrl ?? '';
  form.authorizationEndpoint = record.authorizationEndpoint;
  form.tokenEndpoint = record.tokenEndpoint;
  form.userinfoEndpoint = record.userinfoEndpoint ?? '';
  form.jwksUri = record.jwksUri ?? '';
  form.clientId = record.clientId;
  form.clientSecret = '';
  form.defaultScopesText = stringifyTextareaList(record.defaultScopes);
  form.enabled = record.enabled;
  form.allowLogin = record.allowLogin;
  form.autoRegister = record.autoRegister;
  form.autoLinkByEmail = record.autoLinkByEmail;
  form.usePkce = record.usePkce;
  form.clientAuthMethod = record.clientAuthMethod;
  form.claimMapping.subject = record.claimMapping.subject;
  form.claimMapping.email = record.claimMapping.email ?? '';
  form.claimMapping.username = record.claimMapping.username ?? '';
  form.claimMapping.nickname = record.claimMapping.nickname ?? '';
  form.claimMapping.avatarUrl = record.claimMapping.avatarUrl ?? '';
};

export const buildOAuthProviderPayload = (
  form: OAuthProviderEditorForm,
): OAuthProviderFormPayload => ({
  code: form.code.trim(),
  name: form.name.trim(),
  description: normalizeOptionalText(form.description),
  logoUrl: normalizeOptionalText(form.logoUrl),
  protocol: form.protocol,
  issuer: normalizeOptionalText(form.issuer),
  discoveryUrl: normalizeOptionalText(form.discoveryUrl),
  authorizationEndpoint: form.authorizationEndpoint.trim(),
  tokenEndpoint: form.tokenEndpoint.trim(),
  userinfoEndpoint: normalizeOptionalText(form.userinfoEndpoint),
  jwksUri: normalizeOptionalText(form.jwksUri),
  clientId: form.clientId.trim(),
  clientSecret: form.clientSecret.trim() || undefined,
  defaultScopes: parseTextareaList(form.defaultScopesText),
  enabled: form.enabled,
  allowLogin: form.allowLogin,
  autoRegister: form.autoRegister,
  autoLinkByEmail: form.autoLinkByEmail,
  usePkce: form.usePkce,
  clientAuthMethod: form.clientAuthMethod,
  claimMapping: {
    subject: form.claimMapping.subject.trim(),
    ...(form.claimMapping.email.trim() ? { email: form.claimMapping.email.trim() } : {}),
    ...(form.claimMapping.username.trim() ? { username: form.claimMapping.username.trim() } : {}),
    ...(form.claimMapping.nickname.trim() ? { nickname: form.claimMapping.nickname.trim() } : {}),
    ...(form.claimMapping.avatarUrl.trim() ? { avatarUrl: form.claimMapping.avatarUrl.trim() } : {}),
  },
});

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const validateOAuthProviderForm = (
  form: OAuthProviderEditorForm,
  editingId: string | null,
) => {
  if (!form.code.trim() || !form.name.trim()) {
    return '请完整填写供应商编码和名称';
  }

  if (!form.clientId.trim()) {
    return '请填写客户端 ID';
  }

  if (!editingId && !form.clientSecret.trim()) {
    return '创建供应商时必须填写客户端密钥';
  }

  if (!form.authorizationEndpoint.trim() || !form.tokenEndpoint.trim()) {
    return '请完整填写授权端点和令牌端点';
  }

  const urlCandidates = [
    { label: 'Discovery URL', value: form.discoveryUrl.trim() },
    { label: 'Issuer', value: form.issuer.trim() },
    { label: 'Authorization Endpoint', value: form.authorizationEndpoint.trim() },
    { label: 'Token Endpoint', value: form.tokenEndpoint.trim() },
    { label: 'Userinfo Endpoint', value: form.userinfoEndpoint.trim() },
    { label: 'JWKS URI', value: form.jwksUri.trim() },
    { label: 'Logo URL', value: form.logoUrl.trim() },
  ];

  const invalidField = urlCandidates.find((item) => item.value && !isValidUrl(item.value));
  if (invalidField) {
    return `${invalidField.label} 格式不正确`;
  }

  if (!form.claimMapping.subject.trim()) {
    return 'Claim Mapping 至少需要 subject 字段';
  }

  return undefined;
};

export const resolveOAuthProviderProtocolLabel = (protocol: OAuthProviderProtocol) =>
  protocol === 'OIDC' ? 'OIDC' : 'OAuth 2.0';

export const resolveOAuthProviderClientAuthMethodLabel = (
  method: OAuthProviderClientAuthMethod,
) => method === 'CLIENT_SECRET_BASIC' ? 'Client Secret Basic' : 'Client Secret Post';

export const formatOAuthProviderScopeSummary = (record: OAuthProviderRecord) =>
  record.defaultScopes.length ? record.defaultScopes.join(' / ') : '未配置默认 scope';

export const formatOAuthProviderEndpointSummary = (record: OAuthProviderRecord) =>
  `${formatEndpointHost(record.authorizationEndpoint)} -> ${formatEndpointHost(record.tokenEndpoint)}`;

export const buildOAuthProviderDetailEntries = (record: OAuthProviderRecord) => [
  { label: '供应商编码', value: record.code },
  { label: '协议', value: resolveOAuthProviderProtocolLabel(record.protocol) },
  { label: 'Logo URL', value: record.logoUrl ?? '未配置' },
  { label: '客户端 ID', value: record.clientId },
  { label: '客户端鉴权', value: resolveOAuthProviderClientAuthMethodLabel(record.clientAuthMethod) },
  { label: '允许登录', value: record.allowLogin ? '是' : '否' },
  { label: '自动注册', value: record.autoRegister ? '是' : '否' },
  { label: '邮箱自动关联', value: record.autoLinkByEmail ? '是' : '否' },
  { label: '使用 PKCE', value: record.usePkce ? '是' : '否' },
  { label: '授权端点', value: record.authorizationEndpoint },
  { label: '令牌端点', value: record.tokenEndpoint },
  { label: '用户信息端点', value: record.userinfoEndpoint ?? '未配置' },
  { label: 'JWKS 地址', value: record.jwksUri ?? '未配置' },
  { label: 'Discovery URL', value: record.discoveryUrl ?? '未配置' },
  { label: 'Issuer', value: record.issuer ?? '未配置' },
  { label: '默认 Scopes', value: formatOAuthProviderScopeSummary(record) },
  { label: 'Claim Subject', value: record.claimMapping.subject },
  { label: 'Claim Email', value: record.claimMapping.email ?? '未映射' },
  { label: 'Claim Username', value: record.claimMapping.username ?? '未映射' },
  { label: 'Claim Nickname', value: record.claimMapping.nickname ?? '未映射' },
  { label: 'Claim Avatar', value: record.claimMapping.avatarUrl ?? '未映射' },
];
