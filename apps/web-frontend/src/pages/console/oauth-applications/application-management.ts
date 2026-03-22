import type {
  OAuthApplicationClientType,
  OAuthApplicationFormPayload,
  OAuthApplicationRecord,
} from '@rbac/api-common';
import {
  normalizeOptionalText,
  parseTextareaList,
  stringifyTextareaList,
} from '../oauth/oauth-management';

export type OAuthApplicationEditorForm = {
  code: string;
  name: string;
  description: string;
  logoUrl: string;
  homepageUrl: string;
  clientId: string;
  clientSecret: string;
  clientType: OAuthApplicationClientType;
  redirectUrisText: string;
  postLogoutRedirectUrisText: string;
  defaultScopesText: string;
  enabled: boolean;
  skipConsent: boolean;
  requirePkce: boolean;
  allowAuthorizationCode: boolean;
  allowRefreshToken: boolean;
  permissionIds: string[];
};

export const createEmptyOAuthApplicationEditorForm = (): OAuthApplicationEditorForm => ({
  code: '',
  name: '',
  description: '',
  logoUrl: '',
  homepageUrl: '',
  clientId: '',
  clientSecret: '',
  clientType: 'CONFIDENTIAL',
  redirectUrisText: '',
  postLogoutRedirectUrisText: '',
  defaultScopesText: 'openid\nprofile\nemail\noffline_access',
  enabled: true,
  skipConsent: false,
  requirePkce: true,
  allowAuthorizationCode: true,
  allowRefreshToken: true,
  permissionIds: [],
});

export const assignOAuthApplicationEditorForm = (
  form: OAuthApplicationEditorForm,
  record: OAuthApplicationRecord,
) => {
  form.code = record.code;
  form.name = record.name;
  form.description = record.description ?? '';
  form.logoUrl = record.logoUrl ?? '';
  form.homepageUrl = record.homepageUrl ?? '';
  form.clientId = record.clientId;
  form.clientSecret = '';
  form.clientType = record.clientType;
  form.redirectUrisText = stringifyTextareaList(record.redirectUris);
  form.postLogoutRedirectUrisText = stringifyTextareaList(record.postLogoutRedirectUris);
  form.defaultScopesText = stringifyTextareaList(record.defaultScopes);
  form.enabled = record.enabled;
  form.skipConsent = record.skipConsent;
  form.requirePkce = record.requirePkce;
  form.allowAuthorizationCode = record.allowAuthorizationCode;
  form.allowRefreshToken = record.allowRefreshToken;
  form.permissionIds = record.permissions.map((item) => item.id);
};

export const buildOAuthApplicationPayload = (
  form: OAuthApplicationEditorForm,
): OAuthApplicationFormPayload => ({
  code: form.code.trim(),
  name: form.name.trim(),
  description: normalizeOptionalText(form.description),
  logoUrl: normalizeOptionalText(form.logoUrl),
  homepageUrl: normalizeOptionalText(form.homepageUrl),
  clientId: form.clientId.trim(),
  clientSecret: form.clientSecret.trim() || undefined,
  clientType: form.clientType,
  redirectUris: parseTextareaList(form.redirectUrisText),
  postLogoutRedirectUris: parseTextareaList(form.postLogoutRedirectUrisText),
  defaultScopes: parseTextareaList(form.defaultScopesText),
  enabled: form.enabled,
  skipConsent: form.skipConsent,
  requirePkce: form.requirePkce,
  allowAuthorizationCode: form.allowAuthorizationCode,
  allowRefreshToken: form.allowRefreshToken,
  permissionIds: [...new Set(form.permissionIds)],
});

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const validateOAuthApplicationForm = (
  form: OAuthApplicationEditorForm,
  editingId: string | null,
) => {
  if (!form.code.trim() || !form.name.trim()) {
    return '请完整填写应用编码和名称';
  }

  if (!form.clientId.trim()) {
    return '请填写客户端 ID';
  }

  if (form.clientType === 'CONFIDENTIAL' && !editingId && !form.clientSecret.trim()) {
    return '创建 Confidential 应用时必须填写客户端密钥';
  }

  const redirectUris = parseTextareaList(form.redirectUrisText);
  if (!redirectUris.length) {
    return '至少需要一个 Redirect URI';
  }

  const invalidRedirect = redirectUris.find((item) => !isValidUrl(item));
  if (invalidRedirect) {
    return `Redirect URI 格式不正确：${invalidRedirect}`;
  }

  const postLogoutRedirectUris = parseTextareaList(form.postLogoutRedirectUrisText);
  const invalidPostLogout = postLogoutRedirectUris.find((item) => !isValidUrl(item));
  if (invalidPostLogout) {
    return `Post Logout Redirect URI 格式不正确：${invalidPostLogout}`;
  }

  if (form.logoUrl.trim() && !isValidUrl(form.logoUrl.trim())) {
    return 'Logo URL 格式不正确';
  }

  if (form.homepageUrl.trim() && !isValidUrl(form.homepageUrl.trim())) {
    return 'Homepage URL 格式不正确';
  }

  return undefined;
};

export const resolveOAuthApplicationClientTypeLabel = (
  clientType: OAuthApplicationClientType,
) => clientType === 'PUBLIC' ? 'Public' : 'Confidential';

export const formatOAuthApplicationScopeSummary = (record: OAuthApplicationRecord) =>
  record.defaultScopes.length ? record.defaultScopes.join(' / ') : '未配置默认 scope';

export const formatOAuthApplicationPermissionSummary = (record: OAuthApplicationRecord) =>
  record.permissions.length
    ? record.permissions.map((item) => item.code).join(' / ')
    : '未分配权限 scope';

export const buildOAuthApplicationDetailEntries = (record: OAuthApplicationRecord) => [
  { label: '应用编码', value: record.code },
  { label: '客户端 ID', value: record.clientId },
  { label: '客户端类型', value: resolveOAuthApplicationClientTypeLabel(record.clientType) },
  { label: 'Logo URL', value: record.logoUrl ?? '未配置' },
  { label: '首页地址', value: record.homepageUrl ?? '未配置' },
  { label: '默认 Scopes', value: formatOAuthApplicationScopeSummary(record) },
  { label: '权限 Scopes', value: formatOAuthApplicationPermissionSummary(record) },
  { label: '跳过 Consent', value: record.skipConsent ? '是' : '否' },
  { label: '要求 PKCE', value: record.requirePkce ? '是' : '否' },
  { label: '启用授权码', value: record.allowAuthorizationCode ? '是' : '否' },
  { label: '启用刷新令牌', value: record.allowRefreshToken ? '是' : '否' },
  { label: 'Redirect URIs', value: record.redirectUris.join('\n') || '未配置' },
  { label: 'Post Logout Redirect URIs', value: record.postLogoutRedirectUris.join('\n') || '未配置' },
];
