/// <reference types="vite/client" />

export {};

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

declare module 'vue' {
  export interface GlobalDirectives {
    vPermission: import('vue').Directive<HTMLElement, import('@/utils/access-control').AccessDirectiveValue>;
    vRole: import('vue').Directive<HTMLElement, import('@/utils/access-control').AccessDirectiveValue>;
  }
}
