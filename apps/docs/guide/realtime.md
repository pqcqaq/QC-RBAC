---
title: 实时通信
description: 标准 WebSocket、topic 订阅协议、前后端封装、心跳、重连和使用方式。
---

## 当前实现范围

项目的实时通信已经不再使用 `socket.io`，统一改成标准 `WebSocket`。

当前这套实现分成三层：

- 后端 realtime hub：`apps/backend/src/lib/socket.ts`
- 共享协议与客户端：`packages/api-common/src/realtime/*`
- 平台接入层：`apps/web-frontend/src/api/client.ts`、`apps/app-frontend/src/api/client.ts`

目标不是只把连接打通，而是把后续最常见的需求先抽象好：

- 标准 websocket 握手
- 用户和客户端维度的连接关联
- topic 订阅与分发
- `+`、`#` 通配匹配
- `sub` / `unsub` 与服务端 ack 同步
- 自动连接和自动断开
- 组件级自动订阅
- 心跳保活
- 指数退避重连

## 分层结构

<MermaidDiagram
  label="Realtime layers"
  :code="[
    'flowchart TB',
    '  View[Web / Uni page]',
    '  Hook[useWsTopic]',
    '  Client[wsClient]',
    '  Shared[api-common realtime]',
    '  Hub[backend realtime hub]',
    '  Service[backend business service / route]',
    '',
    '  View --> Hook',
    '  Hook --> Client',
    '  Client --> Shared',
    '  Shared --> Hub',
    '  Service --> Hub',
  ].join('\n')"
/>

职责边界：

- 页面只关心订阅什么 topic、收到消息后做什么。
- `useWsTopic(...)` 负责组件级订阅与销毁解绑。
- `wsClient` 负责连接管理、订阅同步、重连和状态监听。
- `api-common` 负责 topic 规则、协议类型、平台 adaptor、客户端管理器。
- 后端 hub 负责鉴权、连接索引、订阅索引、消息分发和心跳。

## 握手与连接地址

后端 websocket 入口固定是：

```text
/realtime/ws
```

共享层提供：

```ts
resolveRealtimeWsUrl(baseUrl: string, path = '/realtime/ws')
```

作用：

- 把 `http://.../api` 自动转成 `ws://.../realtime/ws`
- 把 `https://.../api` 自动转成 `wss://.../realtime/ws`

### 不同平台的 token 传递方式

| 平台 | 握手方式 |
| --- | --- |
| Web 控制台 | query string 带 `access_token` |
| Uni H5 | 同 Web |
| Uni App / 小程序 | `Authorization` header |

原因：

- 浏览器原生 `WebSocket` 不能稳定自定义认证头
- `uni.connectSocket` 在非浏览器环境可以带 header

## topic 规则

共享规则在：

```text
packages/api-common/src/realtime/topic.ts
```

### 规范

- topic 统一会标准化成以 `/` 开头
- 发布 topic 不能带通配符
- `+` 只匹配单层
- `#` 只能出现在最后一层，并匹配剩余所有层

### 例子

| 订阅 topic | 匹配结果 |
| --- | --- |
| `/chat/global/message` | 只匹配 `/chat/global/message` |
| `/system/users/+/rbac-updated` | 匹配任意单个用户的权限变更 topic |
| `/system/#` | 匹配 `/system` 下所有子 topic |

### 共享方法

这层当前提供：

- `normalizeWsSubscriptionTopic(topic)`
- `normalizeWsPublishTopic(topic)`
- `dedupeWsSubscriptionTopics(topics)`
- `matchWsTopic(topic, subscriptionTopic)`
- `sortWsTopics(topics)`

## 当前内置 topic

共享 helper 在：

```text
packages/api-common/src/types/realtime.ts
```

当前已经定义：

```ts
REALTIME_TOPICS.auditEvent
REALTIME_TOPICS.chatGlobalMessage
REALTIME_TOPICS.presenceChanged
REALTIME_TOPICS.userRbacUpdated(userId)
```

对应业务语义：

| topic | payload |
| --- | --- |
| `/system/audit/event` | `AuditEventPayload` |
| `/chat/global/message` | `LiveMessage` |
| `/system/presence/changed` | `PresenceChangedPayload` |
| `/system/users/<userId>/rbac-updated` | `RbacUpdatedPayload` |

`RbacUpdatedPayload` 现在除了 `reason`、`at` 之外，还会声明本次前端需要刷新的范围：

- `targets: ['user']`
  只需要重新拉取 `auth.me()`，同步当前用户角色、权限、昵称、头像等会话信息
- `targets: ['menus']`
  只需要重新拉取 `menus.current()`，同步动态路由、导航树和工作台标签
- `targets: ['user', 'menus']`
  两者都需要刷新

## 协议消息

共享协议定义在：

```text
packages/api-common/src/realtime/protocol.ts
```

### 服务端发给客户端

- `ready`
  连接建立后的初始化消息，包含 `connectionId`、`userId`、客户端身份、当前 topic、心跳参数。
- `message`
  实际业务消息，包含 `topic`、`payload`、`publishedAt`。
- `sub:ack`
  服务端确认订阅成功，并返回当前服务端记录的完整 topic 列表。
- `unsub:ack`
  服务端确认取消订阅成功，并返回当前服务端记录的完整 topic 列表。
- `ping`
  心跳探测。
- `error`
  协议级错误，例如 topic 非法、订阅失败。

### 客户端发给服务端

- `sub`
- `unsub`
- `pong`

## 心跳与重连

这次实现里，心跳不是页面自己写的，而是客户端基础层和后端 hub 统一处理。

### 后端

后端每 `20s` 发一次 `ping`。

如果某个连接超过 `60s` 没有任何活动：

- 服务端会主动关闭该连接
- 客户端会把它当成非致命中断并进入重连流程

### 客户端

客户端收到 `ping` 会自动回 `pong`。

客户端还会做两件事：

- 本地记录最近一次活动时间
- 如果超过服务端声明的 `heartbeatTimeoutMs` 还没有活动，主动关闭本地连接，进入重连逻辑

### 重连策略

共享 client manager 默认采用指数退避：

- `initialDelayMs = 1000`
- `multiplier = 2`
- `maxDelayMs = 30000`
- `jitterRatio = 0.2`

不会重连的情况：

- 当前没有任何期望订阅 topic
- 用户主动 `disconnect()`
- 服务端用致命错误码关闭，例如认证失败、协议错误

## 后端如何使用

核心文件：

```text
apps/backend/src/lib/socket.ts
```

### 后端暴露的方法

#### `initSocket(server)`

把 realtime hub 挂到 HTTP server 的 `upgrade` 链路上。

它负责：

- 校验访问路径必须是 `/realtime/ws`
- 校验 access token
- 解析当前用户与客户端身份
- 创建连接上下文
- 维护索引
- 发送 `ready`

#### `closeSocketServer()`

服务关闭时主动断开现有连接，并停止心跳定时器。

#### `publishRealtimeMessage(topic, payload)`

这是后端最通用的分发工具。

传入某个发布 topic 后，hub 会：

1. 标准化并校验 topic
2. 找出所有订阅 topic 与之匹配的连接
3. 向这些连接发送 `message`

这是后续新增业务推送时最应该优先复用的方法。

#### `emitAuditEvent(payload)`

发布到：

```text
/system/audit/event
```

#### `emitChatMessage(message)`

发布到：

```text
/chat/global/message
```

#### `emitRbacUpdated(userIds, reason | options)`

按用户维度发布到：

```text
/system/users/<userId>/rbac-updated
```

除了直接传 `reason`，也可以传：

- `reason`
- `targets`

这让业务侧可以明确告诉前端，这次推送只需要同步：

- 当前用户信息
- 菜单和动态路由
- 或两者一起同步

#### `getRealtimeConnectionSnapshot()`

返回当前连接快照，便于排查：

- 总连接数
- 每个用户有哪些连接
- 同一用户下按客户端如何分组

### 后端内部记录了什么

当前 hub 至少维护这些索引：

- `connections`
- `connectionIdsByUserId`
- `connectionIdsByClientKey`
- `connectionIdsByUserAndClientKey`
- `connectionIdsBySubscriptionTopic`

这样后面要做：

- 面向某个用户推送
- 面向某个客户端推送
- 统计在线连接
- 排查某个 topic 为什么没推到

都不需要重新设计底层索引。

## 前端共享层如何使用

共享实时客户端在：

```text
packages/api-common/src/realtime/client.ts
```

### `createWsClient(options)`

这是统一的 websocket client manager。

#### 参数

- `url`
- `adaptor`
- `getAccessToken`
- `getConnectHeaders`
- `getConnectParams`
- `accessTokenTransport`
- `backoff`
- `onError`

#### 返回的方法

##### `connect()`

主动尝试建立连接。

通常不需要业务手动调，因为 `subscribe()` / `onTopic()` 会自动触发连接。

##### `disconnect()`

清空期望 topic，并主动关闭连接。

##### `getState()`

返回当前快照：

- `status`
- `desiredTopics`
- `serverTopics`
- `connectionId`
- `userId`
- `client`
- `heartbeatIntervalMs`
- `heartbeatTimeoutMs`
- `retryAttempt`
- `lastActivityAt`

##### `subscribe(topic | topic[])`

注册“期望订阅 topic”。

特点：

- 支持一次订阅多个
- 自动建立连接
- 等待服务端 `sub:ack`
- 前后端 topic 列表保持同步

##### `unsubscribe(topic | topic[])`

移除期望订阅 topic。

特点：

- 等待服务端 `unsub:ack`
- 如果没有任何 topic，会自动关闭连接

##### `onTopic(topic, handler)`

这是页面层最常用的方法。

它会：

1. 自动订阅 topic
2. 在收到匹配消息时执行 handler
3. 返回取消监听函数

因此业务层一般不需要自己分开写 `subscribe + addEventListener + unsubscribe`。

##### `watchState(listener)`

监听连接状态变化。

适合做：

- UI 上展示在线 / 重连中 / 待连接
- 收集调试信息
- 在状态切换时提示用户

## Web 如何使用

Web 端预配置 client 在：

```text
apps/web-frontend/src/api/client.ts
```

当前已经提供：

- `realtimeWsUrl`
- `wsClient`

控制台登录态下的全局同步器在：

```text
apps/web-frontend/src/realtime/admin-sync.ts
```

组件级封装在：

```text
apps/web-frontend/src/composables/use-ws-topic.ts
```

### 组件内典型写法

```ts
import { REALTIME_TOPICS, type LiveMessage } from '@rbac/api-common'
import { useWsTopic } from '@/composables/use-ws-topic'

useWsTopic<LiveMessage>(REALTIME_TOPICS.chatGlobalMessage, ({ payload }) => {
  console.log(payload.content)
})
```

### `useWsTopic(...)` 做了什么

- 进入组件时自动 `onTopic(...)`
- topic 变化时自动先解绑再重新订阅
- 组件销毁时自动取消订阅

Web 实际接入示例可以直接看：

```text
apps/web-frontend/src/pages/console/live/LiveView.vue
```

### 控制台登录后的自动同步

Web 控制台现在会在登录态下自动订阅：

```ts
REALTIME_TOPICS.userRbacUpdated(currentUserId)
```

`apps/web-frontend/src/realtime/admin-sync.ts` 负责：

- 监听当前用户自己的 `rbac-updated` topic
- 根据 payload 里的 `targets` 判断刷新 `auth.me()`、`menus.current()`，还是两者一起刷新
- 把短时间内多条推送合并成一次同步，避免连续发起多轮重复请求
- 菜单或权限收缩后，把当前页面重定向到仍可访问的 `homePath`

当前服务端推送策略：

- 权限 / 角色变更：`targets: ['user', 'menus']`
- 菜单结构变更：`targets: ['menus']`

## Uni 如何使用

Uni 端预配置 client 在：

```text
apps/app-frontend/src/api/client.ts
```

当前已经提供：

- `realtimeWsUrl`
- `wsClient`

组件级封装在：

```text
apps/app-frontend/src/hooks/useWsTopic.ts
```

### 组件内典型写法

```ts
import { REALTIME_TOPICS, type RbacUpdatedPayload } from '@rbac/api-common'
import { useWsTopic } from '@/hooks/useWsTopic'

useWsTopic<RbacUpdatedPayload>(REALTIME_TOPICS.userRbacUpdated(userId), ({ payload }) => {
  console.log(payload.reason)
})
```

Uni 与 Web 的页面写法尽量保持一致，平台差异只留在 adaptor 和握手参数里。

## 现有平台 adaptor

共享层当前提供：

- `createWebWsAdaptor()`
- `createUniWsAdaptor()`

它们都遵守统一的 `WsAdaptor` 接口：

```ts
interface WsAdaptor {
  connect(options: WsConnectOptions): WsSocketConnection
}
```

所以 `createWsClient(...)` 自己不关心运行平台。

## 新增一个实时业务的推荐方式

### 1. 在共享层定义 topic 和 payload

优先放到：

```text
packages/api-common/src/types/realtime.ts
```

### 2. 后端业务里发布消息

优先调用：

```ts
publishRealtimeMessage(topic, payload)
```

如果这个事件会被频繁复用，再封一层明确 helper，例如：

```ts
emitOrderStatusChanged(...)
```

### 3. 前端页面只订阅 topic

优先使用：

- Web：`useWsTopic(...)`
- Uni：`useWsTopic(...)`

不要在业务页面里重新手写：

- `new WebSocket(...)`
- 心跳逻辑
- 重连逻辑
- 原始 `sub` / `unsub` 协议拼装

## 当前推荐的使用原则

- 页面层优先用 `useWsTopic(...)`
- 非组件上下文优先用 `wsClient.onTopic(...)`
- 后端优先用 `publishRealtimeMessage(...)`
- topic 常量和 payload 类型优先收敛到 `api-common`
- 不要把业务语义写死成零散字符串
- 不要在页面里重复写心跳和重连

## 相关文件索引

- `apps/backend/src/lib/socket.ts`
- `packages/api-common/src/types/realtime.ts`
- `packages/api-common/src/realtime/topic.ts`
- `packages/api-common/src/realtime/protocol.ts`
- `packages/api-common/src/realtime/client.ts`
- `packages/api-common/src/realtime/adapters/web.ts`
- `packages/api-common/src/realtime/adapters/uni.ts`
- `packages/api-common/src/realtime/url.ts`
- `apps/web-frontend/src/api/client.ts`
- `apps/web-frontend/src/composables/use-ws-topic.ts`
- `apps/web-frontend/src/pages/console/live/LiveView.vue`
- `apps/app-frontend/src/api/client.ts`
- `apps/app-frontend/src/hooks/useWsTopic.ts`
