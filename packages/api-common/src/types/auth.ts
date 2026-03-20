import type { PermissionCode } from '../constants/permissions.js';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface LoginPayload {
  account: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  nickname: string;
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

export interface CurrentUser {
  id: string;
  username: string;
  email: string;
  nickname: string;
  avatar?: string | null;
  status: UserStatus;
  roles: RoleSummary[];
  permissions: string[];
}

export interface AuthSession {
  tokens: TokenPair;
  user: CurrentUser;
}
