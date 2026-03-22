---
title: 共享抽象
description: packages/api-common 里统一维护的权限、客户端、请求客户端和 API 工厂。
---

## 包的职责

`packages/api-common` 不是纯类型包，它是多端共享协议层。

当前主要包含：

- 权限常量
- 认证和 RBAC 类型
- 选项分页查询 payload
- 客户端类型与配置结构
- OAuth / 附件 / 导出相关类型
- 请求客户端核心
- Fetch / Uni 适配器
- API 工厂
- 下载请求配置

## 权限常量

权限目录定义在：

```text
packages/api-common/src/constants/permissions.ts
```

作用：

- 后端 seed 直接用它初始化权限目录。
- 前端权限判断也用同一套 code。
- 新增权限时只改一处，前后端同时生效。

## 客户端类型与配置

客户端枚举和结构在：

```text
packages/api-common/src/types/auth-client.ts
```

当前已支持：

- `WEB`
- `UNI_WECHAT_MINIAPP`
- `APP`

每种客户端都有独立 config：

- `WEB`：`protocol`、`host`、`port`
- `UNI_WECHAT_MINIAPP`：`appId`
- `APP`：`packageName`、`platform`

`buildAuthClientHeaders(...)` 会根据类型拼出对应的请求头。

## 请求客户端核心

请求核心在：

```text
packages/api-common/src/client/core.ts
```

它只解决一件事：把“请求 URL、headers、token、401 重试”这些公共逻辑做成跨端通用能力。

关键类型：

- `RequestConfig`
- `DownloadRequestConfig`
- `RequestAdaptor`
- `ClientOptions`

## 平台适配器

当前有两个适配器：

- `src/client/adapters/fetch.ts`
- `src/client/adapters/uni.ts`

区别很简单：

- Web 用 `fetch`
- Uni / App / 小程序用 `uni.request`

两者都遵守同一套 `RequestAdaptor` 接口，所以 `createApiFactory(...)` 不需要关心具体运行平台。

## API 工厂

API 工厂在：

```text
packages/api-common/src/api/factory.ts
```

它统一生成：

- `auth`
- `dashboard`
- `users`
- `roles`
- `permissions`
- `clients`
- `oauth`
- `menus`
- `files`
- `attachments`
- `audit`
- `live`

当前和最近改动强相关的接口包括：

- `api.clients.*`
- `api.attachments.*`
- `api.oauth.providers.*`
- `api.oauth.applications.*`
- `api.oauth.applications.permissions()`
- `api.users.roles()`
- `api.roles.permissions()`
- `api.menus.permissions()`

特点：

- CRUD 资源通过 `createCrudEndpoints(...)` 统一构造。
- 列表导出统一返回 `DownloadRequestConfig`，前端直接拿去下载。
- Web 和 Uni 端都复用同一个 API 面。
- OAuth 应用权限选项这种非 CRUD 能力，也通过同一个 factory 继续暴露，不会散落到端内自己拼 URL。
- 这些选项接口现在统一接受 `OptionSearchPayload`，并通过 `POST` body 传 `page`、`pageSize` 和业务过滤字段，返回分页 summary，便于前端关系选择组件直接复用。

## 为什么这个包重要

如果没有这一层：

- Web 和 Uni 会各自复制一遍请求封装。
- 客户端类型和请求头规则会在多个项目里分叉。
- 权限码会出现前后端不一致。
- 导出接口和普通接口的定义会重复。

现在这层已经把这些分歧点收敛到了一个包里。

## 扩展方式

### 新增权限

1. 改 `constants/permissions.ts`
2. 重新 seed
3. 后端 / 前端直接复用新权限码

### 新增接口

1. 在 `types/` 增加返回值和 payload 类型
2. 在 `api/factory.ts` 增加方法
3. Web / Uni 直接通过对应客户端调用

### 新增客户端类型

1. 在 `types/auth-client.ts` 增加枚举和 config 类型
2. 扩展 `buildAuthClientHeaders(...)`
3. 后端补 schema 和校验
4. Web / Uni / App 的客户端构造逻辑同步跟进
5. 更新 docs，说明新类型对应的 config 字段和运行时校验规则
