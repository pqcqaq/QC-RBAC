import type { Component } from 'vue';

export type PageDefinitionInput = {
  viewKey: string;
  keepAlive?: boolean;
  cacheName?: string;
  title?: string;
  caption?: string;
  description?: string;
  code?: string;
};

export type PageDefinitionRecord = PageDefinitionInput & {
  keepAlive: boolean;
  cacheName: string;
  view: string;
};

export type PageComponentLoader = () => Promise<{ default: Component }>;

export type PageRegistryItem = PageDefinitionRecord & {
  component: PageComponentLoader;
};

export const definePage = <const T extends PageDefinitionInput>(definition: T): T => definition;
