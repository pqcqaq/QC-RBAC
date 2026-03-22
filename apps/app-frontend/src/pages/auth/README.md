# 登录页
需要输入账号和密码的登录页。

## 当前使用方式

当前项目已经启用小程序端登录页，登录拦截会在未登录时跳转到 `src/pages/auth/login.vue`。

是否在小程序中启用登录页，由 `src/router/config.ts` 中的 `LOGIN_PAGE_ENABLE_IN_MP` 控制。

## 登录跳转

登录后的跳转逻辑主要在 `src/router/interceptor.ts` 和 `src/pages/auth/login.vue` 中，默认会重定向回来源页面或首页。
