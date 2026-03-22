import type { PermissionCode } from '../constants/permissions.js';
import type { AuthClientSummary } from './auth-client.js';

export * from './auth-client.js';

export type UserStatus = 'ACTIVE' | 'DISABLED';
export type AuthStrategyCode = 'username-password' | 'email-code' | 'phone-code' | string;
export type AuthIdentifierType = 'USERNAME' | 'EMAIL' | 'PHONE';
export type AuthCredentialType = 'PASSWORD' | 'VERIFICATION_CODE';
export type AuthVerificationPurpose = 'LOGIN' | 'REGISTER';

export interface LegacyLoginPayload {
  account: string;
  password: string;
}

export interface StrategyLoginPayload {
  strategyCode: AuthStrategyCode;
  identifier: string;
  password?: string;
  code?: string;
}

export type LoginPayload = LegacyLoginPayload | StrategyLoginPayload;

export interface LegacyRegisterPayload {
  username: string;
  email: string;
  password: string;
  nickname: string;
}

export interface StrategyRegisterPayload {
  strategyCode: AuthStrategyCode;
  identifier: string;
  username: string;
  nickname: string;
  password?: string;
  code?: string;
  email?: string | null;
}

export type RegisterPayload = LegacyRegisterPayload | StrategyRegisterPayload;

export interface AuthStrategyDescriptor {
  id: string;
  code: AuthStrategyCode;
  name: string;
  description?: string | null;
  identifierType: AuthIdentifierType;
  credentialType: AuthCredentialType;
  enabled: boolean;
  loginEnabled: boolean;
  registerEnabled: boolean;
  verificationEnabled: boolean;
  mockEnabled: boolean;
  sortOrder: number;
}

export interface AuthStrategyCollection {
  strategies: AuthStrategyDescriptor[];
  loginStrategies: AuthStrategyDescriptor[];
  registerStrategies: AuthStrategyDescriptor[];
  verificationStrategies: AuthStrategyDescriptor[];
}

export interface SendVerificationCodePayload {
  strategyCode: AuthStrategyCode;
  identifier: string;
  purpose: AuthVerificationPurpose;
}

export interface VerificationCodeSendResult {
  expiresAt: string;
  mockCode?: string;
}

export interface VerifyVerificationCodePayload {
  strategyCode: AuthStrategyCode;
  identifier: string;
  purpose: AuthVerificationPurpose;
  code: string;
}

export interface VerificationCodeVerifyResult {
  valid: boolean;
  expiresAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RoleSummary {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface PermissionSummary {
  id: string;
  code: PermissionCode | string;
  name: string;
  module: string;
  action: string;
  description?: string;
}

export type WorkbenchSidebarAppearance = 'light' | 'dark';
export type WorkbenchLayoutMode = 'sidebar' | 'tabs';
export type WorkbenchPageTransitionMode = 'none' | 'fade' | 'slide';
export type WorkbenchCachedTabDisplayMode = 'hidden' | 'classic' | 'browser';

export interface WorkbenchVisitedTab {
  path: string;
  name: string;
  title: string;
  code: string;
  icon: string;
  closable: boolean;
}

export interface UserWorkbenchPreferences {
  themePresetId: string;
  sidebarAppearance: WorkbenchSidebarAppearance;
  sidebarCollapsed: boolean;
  layoutMode: WorkbenchLayoutMode;
  pageTransition: WorkbenchPageTransitionMode;
  cachedTabDisplayMode: WorkbenchCachedTabDisplayMode;
  visitedTabs: WorkbenchVisitedTab[];
  pageStateMap: Record<string, unknown>;
}

export interface UserPreferences {
  workbench?: UserWorkbenchPreferences;
}

export interface CurrentUser {
  id: string;
  username: string;
  email: string | null;
  nickname: string;
  avatar?: string | null;
  status: UserStatus;
  roles: RoleSummary[];
  permissions: string[];
  preferences: UserPreferences;
}

export interface AuthSession {
  tokens: TokenPair;
  user: CurrentUser;
  client: AuthClientSummary;
}

