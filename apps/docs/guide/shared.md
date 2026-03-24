---
title: 共享抽象
description: packages/api-common 里统一维护的 RBAC 类型、客户端、请求核心、realtime 协议与 API 工厂。
---

## 这个包的定位

`packages/api-common` 不是纯类型包，而是多端共享协议层。

它负责把这些最容易分叉的东西收敛到一个地方：

- 认证和 RBAC 类型
- 客户端类型与配置结构
- 请求客户端核心
- Fetch / Uni 适配器
- WebSocket topic 协议与客户端管理器
- API 工厂
- 导出下载请求配置

## 分层结构

<MermaidDiagram
  label="api-common layers"
  :code="[
    'flowchart TB',
    '  Const[constants / types]',
    '  Core[client/core.ts]',
    '  Fetch[client/adapters/fetch.ts]',
    '  Uni[client/adapters/uni.ts]',
    '  Factory[api/factory.ts]',
    '  Web[web-frontend]',
    '  App[app-frontend]',
    '  Backend[backend route contracts]',
    '',
    '  Const --> Core',
    '  Core --> Fetch',
    '  Core --> Uni',
    '  Core --> Factory',
    '  Factory --> Web',
    '  Factory --> App',
    '  Const --> Backend',
  ].join('\n')"
/>

## 权限码与运行时来源

系统权限种子现在在：

```text
apps/backend/src/constants/system-permissions.ts
```

运行时边界已经收敛成三层：

- 后端 seed / bootstrap 用 `systemPermissionCatalog` 和 `system-rbac.ts` 初始化 `Permission`、系统角色、菜单以及 `RealtimeTopic`。
- 前端运行时权限来自 `/api/auth/me` 和 `/api/menus/current`，而不是读取一份共享常量目录。
- `packages/api-common` 负责维护 RBAC 类型、`CurrentUser`、API 方法、`REALTIME_TOPICS` 和 websocket topic helper，但不承担运行时权限目录。

这次这样拆开的目的很直接：

- 共享包负责协议和类型，不负责后端运行时配置。
- 权限和 topic 绑定可以在数据库里扩展，不需要为了运行时行为去改 shared 常量。
- 前端永远以服务端返回的当前权限和菜单树为准，避免本地常量和真实授权状态漂移。

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

### 共享客户端请求头规则

| 类型 | 必带请求头 |
| --- | --- |
| `WEB` | `X-RBAC-Client-Code`、`X-RBAC-Client-Secret` |
| `UNI_WECHAT_MINIAPP` | 上面两项 + `X-RBAC-Client-App-Id` |
| `APP` | 上面两项 + `X-RBAC-Client-Package-Name`，可选 `X-RBAC-Client-Platform` |

Web 不需要把 host / protocol / port 放进请求头里，因为后端直接从 `Origin / Referer / Host` 推断并校验。

## 请求核心

请求核心在：

```text
packages/api-common/src/client/core.ts
```

它解决的不是“具体怎么发请求”，而是统一这些抽象：

- `RequestConfig`
- `DownloadRequestConfig`
- `RequestAdaptor`
- `ClientOptions`

这样 Web 和 Uni 的差别只剩“底层适配器”不同，而不是每个接口都分开写一遍。

## 平台适配器

当前有两个适配器：

- `src/client/adapters/fetch.ts`
- `src/client/adapters/uni.ts`

区别很简单：

- Web 用 `fetch`
- Uni / App / 小程序用 `uni.request`

但两者都遵守同一套 `RequestAdaptor` 接口，所以 `createApiFactory(...)` 本身不关心平台。

## 实时通信抽象

当前 websocket 共享层也已经收敛到 `packages/api-common`：

- `src/realtime/topic.ts`
- `src/realtime/protocol.ts`
- `src/realtime/client.ts`
- `src/realtime/adapters/web.ts`
- `src/realtime/adapters/uni.ts`

这层提供：

- 标准 `WebSocket` 协议消息定义
- `/` 分级 topic
- `+` 和 `#` 通配匹配
- Web / Uni 平台 adaptor
- 自动连接、自动断开、自动重连
- 指数退避
- 心跳超时检测
- `subscribe / unsubscribe / onTopic / watchState`

完整使用方式、协议和方法清单，直接看 [实时通信](/guide/realtime)。

### topic 规则

- topic 统一标准化为以 `/` 开头
- 发布 topic 不能带通配符
- `+` 只匹配单层
- `#` 只能放在最后一层，并匹配当前层之后的全部路径

典型 topic：

- `/chat/global/message`
- `/system/presence/changed`
- `/system/audit/event`
- `/system/users/<userId>/rbac-updated`

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
- `realtimeTopics`

### API 工厂的组织方式

- CRUD 资源走 `createCrudEndpoints(...)`
- 导出接口统一返回 `DownloadRequestConfig`
- 关系选择这类分页选项接口统一走 `POST + body`，并且同一个 endpoint 自带 `resolve(ids)` 回显能力
- 非 CRUD 能力，例如 `oauthAuthorizeUrl`、`exchangeOauthTicket`、`permissionSources`，继续作为明确方法挂在对应分组下

## 一次请求是怎么贯通的

<MermaidDiagram
  label="Shared request flow"
  :code="[
    'sequenceDiagram',
    '  participant View as Frontend View',
    '  participant Api as api.* method',
    '  participant Client as request client',
    '  participant Adaptor as fetch / uni adaptor',
    '  participant Backend',
    '',
    '  View->>Api: api.users.list(params)',
    '  Api->>Client: request config',
    '  Client->>Adaptor: normalized request',
    '  Adaptor->>Backend: HTTP request',
    '  Backend-->>Adaptor: ApiEnvelope',
    '  Adaptor-->>Client: parsed data',
    '  Client-->>Api: typed result',
    '  Api-->>View: typed payload',
  ].join('\n')"
/>

## 最近和当前实现强相关的共享接口

- `api.clients.*`
- `api.attachments.*`
- `api.oauth.providers.*`
- `api.oauth.applications.*`
- `api.oauth.applications.permissions()`
- `api.users.roles()`
- `api.roles.permissions()`
- `api.menus.permissions()`
- `api.realtimeTopics.*`
- `api.realtimeTopics.permissions()`

这些接口已经覆盖：

- 客户端按类型配置
- 附件标签筛选与导出
- OAuth Provider / Application 管理
- 关系选择组件的分页选项协议和编辑态回显协议

## 为什么这层重要

如果没有 `api-common`：

- Web 和 Uni 会各自复制一套请求封装
- 客户端类型和请求头规则会在多个项目里分叉
- RBAC 类型、topic 协议和 API 返回结构容易前后端不一致
- 下载接口和普通接口的声明会重复

现在这些边界都被收敛到一个共享包里。

## 扩展方式

### 新增权限

1. 改 `apps/backend/src/constants/system-permissions.ts`
2. 如果要进默认角色、菜单或 realtime 订阅能力，继续改 `apps/backend/src/services/system-rbac.ts`
3. 重新 seed / migrate
4. 前端继续通过 `/api/auth/me` 和 `/api/menus/current` 消费运行时结果

### 新增 realtime topic

1. 在 `packages/api-common/src/types/realtime.ts` 增加 topic helper 和 payload 类型
2. 在 `apps/backend/src/constants/system-permissions.ts` 增加对应的订阅权限
3. 在 `apps/backend/src/topics/*.ts` 注册 `topicPattern`、`permissionCode` 和订阅生命周期回调
4. 如需后台配置或前端 CRUD，再复用 `api.realtimeTopics.*` 和 `RealtimeTopicRecord / RealtimeTopicFormPayload`
5. 让 `apps/backend/src/services/system-rbac.ts` 把 topic 注册项 seed 到 `RealtimeTopic`
6. 前端继续只订阅 topic，不直接维护权限覆盖规则

### 新增接口

1. 在 `types/` 增加返回值和 payload 类型
2. 在 `api/factory.ts` 增加方法
3. Web / Uni 直接通过对应客户端调用

### 新增客户端类型

1. 在 `types/auth-client.ts` 增加枚举和 config 类型
2. 扩展 `buildAuthClientHeaders(...)`
3. 后端补 schema 和运行时校验
4. Web / Uni 的客户端构造逻辑同步跟进
5. 更新 docs


