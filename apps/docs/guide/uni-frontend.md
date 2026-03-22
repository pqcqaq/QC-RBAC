---
title: Uni 前端
description: uni-app 端的认证、页面结构、自定义布局和跨端适配方式。
---

## 目录结构

```text
apps/app-frontend/src
├─ api
├─ components
├─ composables
├─ hooks
├─ http
├─ pages
├─ store
├─ tabbar
├─ types
└─ utils
```

## 当前页面

当前移动端已经实现：

- `pages/auth/login.vue`
- `pages/auth/register.vue`
- `pages/index/index.vue`
- `pages/me/me.vue`
- `pages/me/profile.vue`
- `pages/settings/index.vue`

## 认证与请求

Uni 端请求入口在 `src/api/client.ts`。

这里做了几件事：

- 根据条件编译推断默认客户端类型：
  - 微信小程序：`UNI_WECHAT_MINIAPP`
  - App：`APP`
  - 其他环境：`WEB`
- 自动拼出客户端请求头：
  - 小程序带 `appId`
  - App 带 `packageName` / `platform`
- 使用 `createUniAdaptor()` 生成统一请求客户端
- 401 时自动 refresh，失败后清理本地登录态

登录态在 `src/store/token.ts`：

- `bootstrap()`：启动时恢复 refresh token，并尝试拉取用户信息
- `login()` / `register()`：写入 token 和用户信息
- `refreshToken()`：刷新 access token
- `logout()`：登出并清理本地状态

## 自定义 Header、Tabbar 和安全区

Uni 端没有使用第三方 UI 库，布局基础全是自定义组件。

关键文件：

- `src/composables/useAppLayout.ts`
- `src/components/app-page-shell/app-page-shell.vue`
- `src/components/app-nav-bar/app-nav-bar.vue`
- `src/tabbar/index.vue`
- `src/utils/systemInfo.ts`

实现方式：

- 通过 `safeAreaInsets` 和 `statusBarHeight` 计算顶部、底部安全区。
- `useAppLayout()` 输出统一 CSS 变量：
  - `--app-safe-top`
  - `--app-safe-bottom`
  - `--app-nav-height`
  - `--app-tabbar-height`
- 所有页面默认 `navigationStyle: 'custom'`，隐藏原生 Header。
- 自定义 Tabbar 自动处理底部安全区。

## 页面外壳与公共组件

页面默认包在 `AppPageShell` 中，统一处理：

- Header 标题
- 返回逻辑
- 页面描述
- 内容区边距

业务组件主要放在 `src/components/`，当前常用的有：

- `AppButton`
- `AppInput`
- `AppList`
- `AppListItem`
- `AppSection`
- `AppStatus`
- `AppTag`
- `AppAvatar`

这样做的目的很直接：保证 App、H5、微信小程序都能走同一套组件和样式语义。

## 页面组织方式

当前页面都比较轻，主要依赖公共组件拼装：

- 登录页：账号密码登录，底部提供注册入口
- 注册页：完成基础注册
- 门户页：展示概览、快捷入口、最近动态
- 我的页：展示当前用户、角色、状态和登录操作
- 设置页：展示已同步的控制台偏好

页面中的数据请求一般通过：

- `src/api/*.ts`
- `src/hooks/useRequest.ts`
- Pinia store

## Tabbar

自定义 Tabbar 相关文件：

- `src/tabbar/config.ts`
- `src/tabbar/store.ts`
- `src/tabbar/index.vue`

特点：

- 默认使用自定义 Tabbar，不依赖原生样式
- 通过 `isPageTabbar(path)` 判断当前页是否需要底部导航
- 根据用户角色动态过滤可见 tab
- 自动记录当前选中项

## 新增一个移动端页面

1. 在 `src/pages` 下新增页面文件。
2. 页面用 `definePage({ style: { navigationStyle: 'custom' } })`，默认走自定义 Header。
3. 使用 `AppPageShell` 包住页面。
4. 如果是 Tabbar 页面，补 `src/tabbar/config.ts`。
5. 请求统一走 `src/api/client.ts` 生成的 `appApi`，不要直接散写 `uni.request`。
