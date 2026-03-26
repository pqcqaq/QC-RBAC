import type { UserPreferences } from '@rbac/api-common';
import { z } from 'zod';

const workbenchVisitedTabSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  code: z.string().min(1),
  icon: z.string().min(1),
  closable: z.boolean(),
});

const workbenchPreferencesSchema = z.object({
  themePresetId: z.string().min(1),
  themeMode: z.enum(['light', 'dark', 'auto']),
  sidebarAppearance: z.enum(['light', 'dark']),
  sidebarCollapsed: z.boolean(),
  layoutMode: z.enum(['sidebar', 'tabs']),
  pageTransition: z.enum(['none', 'fade', 'slide']),
  cachedTabDisplayMode: z.enum(['hidden', 'classic', 'browser']),
  visitedTabs: z.array(workbenchVisitedTabSchema),
  pageStateMap: z.record(z.string(), z.unknown()),
});

const appPreferencesSchema = z.object({
  themeMode: z.enum(['light', 'dark', 'auto']),
  themePresetId: z.enum(['graphite', 'ocean', 'forest', 'sunset']),
  surfaceStyle: z.enum(['solid', 'soft', 'glass']),
  density: z.enum(['comfortable', 'compact']),
  tabbarStyle: z.enum(['floating', 'solid']),
  portalLayout: z.enum(['overview', 'focus']),
  motionEnabled: z.boolean(),
});

export const userPreferencesSchema = z.object({
  workbench: workbenchPreferencesSchema.optional(),
  app: appPreferencesSchema.optional(),
});

export const normalizeUserPreferences = (value: unknown): UserPreferences => {
  const result = userPreferencesSchema.safeParse(value);
  return result.success ? result.data : {};
};

export const mergeUserPreferences = (
  currentValue: unknown,
  nextValue: Partial<UserPreferences>,
): UserPreferences =>
  userPreferencesSchema.parse({
    ...normalizeUserPreferences(currentValue),
    ...nextValue,
  });
