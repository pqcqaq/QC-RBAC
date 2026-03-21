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
