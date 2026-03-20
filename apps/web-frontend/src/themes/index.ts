import presets from 'virtual:admin-theme-presets';

export type ThemePreset = {
  id: string;
  label: string;
  description: string;
  tokens: Record<string, string>;
};

export const themePresets = presets as ThemePreset[];

export const defaultThemePresetId = themePresets[0]?.id ?? 'graphite';

export const findThemePreset = (themeId: string) =>
  themePresets.find((preset) => preset.id === themeId) ?? themePresets[0];

export const applyThemePreset = (themeId: string) => {
  const preset = findThemePreset(themeId);
  if (!preset || typeof document === 'undefined') {
    return preset;
  }

  Object.entries(preset.tokens).forEach(([token, value]) => {
    document.documentElement.style.setProperty(token, value);
  });

  document.documentElement.dataset.themePreset = preset.id;
  return preset;
};
