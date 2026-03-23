import presets from 'virtual:admin-theme-presets';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedThemeMode = Exclude<ThemeMode, 'auto'>;

export type ThemePreset = {
  id: string;
  label: string;
  description: string;
  lightTokens: Record<string, string>;
  darkTokens: Record<string, string>;
};

export type SidebarAppearance = 'dark' | 'light';

type ThemeTransitionOptions = {
  animate?: boolean;
  origin?: HTMLElement | null;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
};

const DARK_MODE_QUERY = '(prefers-color-scheme: dark)';
const THEME_TRANSITION_DURATION_MS = 520;

export const themePresets = presets as ThemePreset[];

export const defaultThemePresetId = themePresets[0]?.id ?? 'graphite';
export const defaultThemeMode: ThemeMode = 'auto';
export const defaultSidebarAppearance: SidebarAppearance = 'dark';

export const themeModeOptions = [
  { value: 'light', label: '亮色', description: '始终保持亮色界面。', icon: 'i-carbon-sun' },
  { value: 'dark', label: '暗色', description: '始终保持暗色界面。', icon: 'i-carbon-moon' },
  { value: 'auto', label: '自动', description: '跟随系统明暗模式。', icon: 'i-carbon-laptop' },
] as const satisfies Array<{
  value: ThemeMode;
  label: string;
  description: string;
  icon: string;
}>;

export const resolveThemeMode = (mode: ThemeMode): ResolvedThemeMode => {
  if (mode === 'dark') {
    return 'dark';
  }

  if (mode === 'auto' && typeof window !== 'undefined' && window.matchMedia(DARK_MODE_QUERY).matches) {
    return 'dark';
  }

  return 'light';
};

export const findThemePreset = (themeId: string) =>
  themePresets.find((preset) => preset.id === themeId) ?? themePresets[0];

export const getThemePresetTokens = (themeId: string, resolvedMode: ResolvedThemeMode) => {
  const preset = findThemePreset(themeId);
  if (!preset) {
    return undefined;
  }

  return resolvedMode === 'dark' ? preset.darkTokens : preset.lightTokens;
};

export const getThemeModeLabel = (mode: ThemeMode) =>
  themeModeOptions.find((option) => option.value === mode)?.label ?? '自动';

export const applyThemePreset = (themeId: string, resolvedMode: ResolvedThemeMode) => {
  const preset = findThemePreset(themeId);
  const tokens = preset
    ? resolvedMode === 'dark'
      ? preset.darkTokens
      : preset.lightTokens
    : undefined;

  if (!preset || !tokens || typeof document === 'undefined') {
    return preset;
  }

  Object.entries(tokens).forEach(([token, value]) => {
    document.documentElement.style.setProperty(token, value);
  });

  document.documentElement.dataset.themePreset = preset.id;
  return preset;
};

export const applyThemeMode = (mode: ThemeMode, resolvedMode: ResolvedThemeMode) => {
  if (typeof document === 'undefined') {
    return resolvedMode;
  }

  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.themeScheme = resolvedMode;
  document.documentElement.style.colorScheme = resolvedMode;
  return resolvedMode;
};

export const applySidebarAppearance = (appearance: SidebarAppearance) => {
  if (typeof document === 'undefined') {
    return appearance;
  }

  document.documentElement.dataset.sidebarAppearance = appearance;
  return appearance;
};

export const subscribeToSystemThemeChange = (callback: (resolvedMode: ResolvedThemeMode) => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(DARK_MODE_QUERY);
  const listener = (event: MediaQueryListEvent) => {
    callback(event.matches ? 'dark' : 'light');
  };

  mediaQuery.addEventListener('change', listener);
  return () => {
    mediaQuery.removeEventListener('change', listener);
  };
};

const setThemeTransitionOrigin = (origin?: HTMLElement | null) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const rect = origin?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height / 2 : 72;

  document.documentElement.style.setProperty('--theme-switch-origin-x', `${Math.round(x)}px`);
  document.documentElement.style.setProperty('--theme-switch-origin-y', `${Math.round(y)}px`);
};

export const runThemeTransition = (apply: () => void, options: ThemeTransitionOptions = {}) => {
  if (typeof document === 'undefined' || typeof window === 'undefined' || options.animate === false) {
    apply();
    return Promise.resolve();
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply();
    return Promise.resolve();
  }

  const root = document.documentElement;
  const cleanup = () => {
    delete root.dataset.themeTransition;
  };

  setThemeTransitionOrigin(options.origin);
  root.dataset.themeTransition = 'running';

  const viewTransitionDocument = document as DocumentWithViewTransition;
  if (typeof viewTransitionDocument.startViewTransition === 'function') {
    const transition = viewTransitionDocument.startViewTransition(() => {
      apply();
    });

    return transition.finished.finally(cleanup);
  }

  apply();
  return new Promise<void>((resolve) => {
    window.setTimeout(() => {
      cleanup();
      resolve();
    }, THEME_TRANSITION_DURATION_MS);
  });
};
