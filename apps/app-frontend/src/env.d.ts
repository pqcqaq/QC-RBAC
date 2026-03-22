/// <reference types="vite/client" />
/// <reference types="vite-svg-loader" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

interface ImportMetaEnv {
  /** 网站标题，应用名称 */
  readonly VITE_APP_TITLE: string
  /** 服务端口号 */
  readonly VITE_SERVER_PORT: string
  /** 后台接口地址 */
  readonly VITE_SERVER_BASEURL: string
  /** 备用后台接口地址 */
  readonly VITE_SERVER_BASEURL_SECONDARY?: string
  /** H5是否需要代理 */
  readonly VITE_APP_PROXY_ENABLE: 'true' | 'false'
  /** H5是否需要代理，需要的话有个前缀 */
  readonly VITE_APP_PROXY_PREFIX: string
  /** 后端是否有统一前缀 /api */
  readonly VITE_SERVER_HAS_API_PREFIX: 'true' | 'false'
  /** 认证模式，'single' | 'double' ==> 单token | 双token */
  readonly VITE_AUTH_MODE: 'single' | 'double'
  /** 客户端类型，H5 环境会强制走 WEB */
  readonly VITE_AUTH_CLIENT_TYPE?: string
  /** 默认客户端编码 */
  readonly VITE_AUTH_CLIENT_CODE?: string
  /** 默认客户端密钥 */
  readonly VITE_AUTH_CLIENT_SECRET?: string
  /** H5 专用客户端编码 */
  readonly VITE_AUTH_WEB_CLIENT_CODE?: string
  /** H5 专用客户端密钥 */
  readonly VITE_AUTH_WEB_CLIENT_SECRET?: string
  /** 小程序专用客户端编码 */
  readonly VITE_AUTH_MINIAPP_CLIENT_CODE?: string
  /** 小程序专用客户端密钥 */
  readonly VITE_AUTH_MINIAPP_CLIENT_SECRET?: string
  /** App 专用客户端编码 */
  readonly VITE_AUTH_APP_CLIENT_CODE?: string
  /** App 专用客户端密钥 */
  readonly VITE_AUTH_APP_CLIENT_SECRET?: string
  /** 小程序 AppID */
  readonly VITE_AUTH_CLIENT_APP_ID?: string
  /** 兼容旧配置的小程序 AppID */
  readonly VITE_WX_APPID?: string
  /** App 包名 */
  readonly VITE_APP_PACKAGE_NAME?: string
  /** App 平台 */
  readonly VITE_APP_PLATFORM?: string
  /** H5 协议 */
  readonly VITE_AUTH_WEB_PROTOCOL?: string
  /** H5 主机 */
  readonly VITE_AUTH_WEB_HOST?: string
  /** H5 端口 */
  readonly VITE_AUTH_WEB_PORT?: string
  /** 是否清除console */
  readonly VITE_DELETE_CONSOLE: string
  // 更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __VITE_APP_PROXY__: 'true' | 'false'
