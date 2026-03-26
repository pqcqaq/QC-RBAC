---
title: Uni 前端
description: uni-app 端的认证、页面结构、自定义布局、全局 UI 偏好与头像分步上传方案。
---

## 先从哪些文件读起

1. `apps/app-frontend/src/api/client.ts`
2. `apps/app-frontend/src/store/token.ts`
3. `apps/app-frontend/src/store/user.ts`
4. `apps/app-frontend/src/store/ui.ts`
5. `apps/app-frontend/src/composables/useManagedAvatarUpload.ts`
6. `apps/app-frontend/src/components/app-page-shell/app-page-shell.vue`

这几处分别对应请求协议、登录态、用户信息、全局 UI 偏好、头像上传流程和页面壳层。

## 目录结构

```text
apps/app-frontend/src
├─ api
├─ components
├─ composables
├─ hooks
├─ pages
├─ store
├─ style
├─ tabbar
├─ types
└─ utils
```

## 当前页面

当前移动端已实现：

- `pages/auth/login.vue`
- `pages/auth/register.vue`
- `pages/index/index.vue`
- `pages/me/me.vue`
- `pages/me/profile.vue`
- `pages/settings/index.vue`

`src/pages.json` 是实际路由与 tabbar 配置的事实来源。

## 认证与请求

Uni 端请求入口在 `src/api/client.ts`。

核心行为：

- 根据条件编译推断客户端类型（`WEB` / `APP` / `UNI_WECHAT_MINIAPP`）
- 注入客户端凭证头（client code/secret + config）
- 401 自动尝试 refresh，失败后清理本地会话
- 统一通过 `createUniAdaptor()` 创建 API 客户端
- 统一通过 `createUniWsAdaptor()` 创建 realtime 客户端

登录态主要在 `src/store/token.ts`：

- `bootstrap()`
- `login()` / `register()` / `logout()`
- `refreshToken()`
- `tryGetValidToken()`

## 用户与偏好存储

### user store

文件：`src/store/user.ts`

- `setUserInfo`：写入当前用户，并同步 hydrate `preferences.app` 到 `ui store`
- `setAppPreferences`：仅更新 `preferences.app`
- `clearUserInfo`：清空用户并重置 UI 偏好

### ui store

文件：`src/store/ui.ts`

`UserAppPreferences` 字段如下：

- `themeMode`: `light | dark | auto`
- `themePresetId`: `graphite | ocean | forest | sunset`
- `surfaceStyle`: `solid | soft | glass`
- `density`: `comfortable | compact`
- `tabbarStyle`: `floating | solid`
- `portalLayout`: `overview | focus`
- `motionEnabled`: `boolean`

`ui store` 提供：

- `hydrateFromUserPreferences(next)`
- `patchPreferences(next)`
- `persistPreferences()`（调用 `/auth/preferences`）
- `rootCssVars`（注入全局 CSS Variables）

## 全局样式与 Tabbar 联动

### 根变量注入

`src/App.ku.vue` 会合并：

- `useAppLayout().rootCssVars`（安全区、导航高、tabbar 高）
- `useUiStore().rootCssVars`（主题色、密度、surface/tabbar 外观）

并注入到 `.app-root`。

### 样式消费

`src/style/index.scss` 消费核心变量：

- 背景与文本：`--app-bg*`、`--app-text*`
- 强调色：`--app-accent*`
- 密度与动效：`--app-density-scale`、`--app-motion-duration`
- tabbar：`--app-tabbar-*`

### Tabbar 外观

文件：

- `src/tabbar/index.vue`
- `src/tabbar/TabbarItem.vue`

`tabbarStyle` 支持：

- `floating`：横向留白 + 圆角 + 阴影
- `solid`：贴边 + 去除圆角和侧边框

## 头像分步上传（Uni 端）

文件：`src/composables/useManagedAvatarUpload.ts`

流程：

1. `chooseImage` / `chooseMedia` 选图
2. 本地校验文件大小与图片宽高
3. `POST /files/presign` 获取上传计划
4. `uni.uploadFile` 上传分片（头像场景要求 `single`）
5. `POST /files/callback` 完成上传
6. `PUT /auth/avatar` 绑定头像

默认限制：

- 最大大小：`5MB`
- 最大尺寸：`1400 x 1400`

> 旧 `useUpload` 仍可用于普通上传，但头像应统一使用 `useManagedAvatarUpload`，避免绕过后端受控上传流程。

## 页面职责

- 首页 `pages/index/index.vue`
  - 门户模式（`overview/focus`）联动
  - 指标、动态、成员与快捷入口

- 我的 `pages/me/me.vue`
  - 账户状态、角色摘要、设置入口

- 个人信息 `pages/me/profile.vue`
  - 昵称/邮箱编辑
  - 头像分步上传与权限提示

- 设置 `pages/settings/index.vue`
  - 主题、surface、密度、tabbar、门户布局、动效
  - 保存后同步到 `preferences.app`

## 新增一个移动端页面

1. 在 `src/pages` 下新增页面
2. 用 `AppPageShell` 统一壳层
3. 请求统一走 `appApi`
4. 涉及用户与偏好时优先进入 `store`
5. 注册到 `pages.json`（必要时补 tabbar）
