import type { AuthSession, CurrentUser } from '@rbac/api-common'
import { appApi } from './client'

export interface ILoginForm {
  account: string
  password: string
}

export interface IRegisterForm {
  username: string
  email: string
  password: string
  nickname: string
}

export function login(loginForm: ILoginForm) {
  return appApi.auth.login(loginForm)
}

export function register(payload: IRegisterForm) {
  return appApi.auth.register(payload)
}

export function refreshToken(refreshToken: string) {
  return appApi.auth.refresh(refreshToken)
}

export function getUserInfo() {
  return appApi.auth.me()
}

export function logout(refreshToken?: string) {
  if (!refreshToken) {
    return Promise.resolve({ ok: true as const })
  }
  return appApi.auth.logout(refreshToken)
}

export function getDashboardSummary() {
  return appApi.dashboard.summary()
}

export type IAuthLoginRes = AuthSession
export type IUserInfoRes = CurrentUser

export function wxLogin() {
  return Promise.reject(new Error('当前项目未启用微信一键登录'))
}
