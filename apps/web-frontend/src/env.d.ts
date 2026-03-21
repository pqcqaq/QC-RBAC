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

declare module 'virtual:page-registry' {
  import type { PageRegistryItem } from '@/meta/page-definition';

  export const pageRegistry: PageRegistryItem[];
  export const pageRegistryMap: Record<string, PageRegistryItem>;
}
