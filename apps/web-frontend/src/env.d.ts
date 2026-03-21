/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

declare module 'virtual:admin-theme-presets' {
  const presets: Array<{
    id: string;
    label: string;
    description: string;
    tokens: Record<string, string>;
  }>;
  export default presets;
}
