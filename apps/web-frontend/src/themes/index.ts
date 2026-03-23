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

type ThemeTokenMap = Record<string, string>;
type ThemePresetInput = Partial<ThemePreset> & {
  light?: ThemeTokenMap;
  dark?: ThemeTokenMap;
};

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toThemeTokenMap = (value: unknown): ThemeTokenMap => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
};

const fallbackThemePreset: ThemePreset = {
  id: 'graphite',
  label: '石墨蓝',
  description: '默认主题',
  lightTokens: {
    '--accent': '#1f4f8d',
    '--accent-strong': '#173c68',
    '--accent-soft': '#e9f1fb',
    '--sidebar-bg': '#0f1822',
    '--sidebar-bg-2': '#15212d',
    '--surface-0': '#ffffff',
    '--surface-1': '#f7f9fc',
    '--surface-2': '#eef3f8',
    '--surface-3': '#d9e2ec',
    '--ink-1': '#16212d',
    '--ink-2': '#405262',
    '--ink-3': '#6e7e8d',
    '--accent-rgb': '31, 79, 141',
  },
  darkTokens: {
    '--accent': '#7eaef5',
    '--accent-strong': '#5a8cdf',
    '--accent-soft': '#1b2f4b',
    '--sidebar-bg': '#0b121a',
    '--sidebar-bg-2': '#101a24',
    '--surface-0': '#111a24',
    '--surface-1': '#17212c',
    '--surface-2': '#1d2936',
    '--surface-3': '#304253',
    '--ink-1': '#eef4fb',
    '--ink-2': '#c5d2df',
    '--ink-3': '#93a4b6',
    '--accent-rgb': '126, 174, 245',
  },
};

const normalizeThemePreset = (input: unknown, index: number): ThemePreset => {
  const source = isRecord(input) ? (input as ThemePresetInput) : {};
  const lightTokens = toThemeTokenMap(source.lightTokens ?? source.light);
  const darkTokens = toThemeTokenMap(source.darkTokens ?? source.dark);

  return {
    id: typeof source.id === 'string' && source.id.trim() ? source.id : `preset-${index + 1}`,
    label: typeof source.label === 'string' && source.label.trim() ? source.label : `主题 ${index + 1}`,
    description: typeof source.description === 'string' ? source.description : '',
    lightTokens: Object.keys(lightTokens).length ? lightTokens : fallbackThemePreset.lightTokens,
    darkTokens: Object.keys(darkTokens).length ? darkTokens : fallbackThemePreset.darkTokens,
  };
};

export const themePresets = Array.isArray(presets) && presets.length
  ? presets.map((preset, index) => normalizeThemePreset(preset, index))
  : [fallbackThemePreset];

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
  themePresets.find((preset) => preset.id === themeId) ?? themePresets[0] ?? fallbackThemePreset;

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
