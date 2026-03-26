import type {
  AppThemeMode,
  AppThemePresetId,
  UserAppPreferences,
} from '@rbac/api-common'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { appApi } from '@/api/client'

const APP_THEME_PRESET_IDS = ['graphite', 'ocean', 'forest', 'sunset'] as const
const APP_THEME_MODES = ['light', 'dark', 'auto'] as const

export const defaultAppPreferences: UserAppPreferences = {
  themeMode: 'auto',
  themePresetId: 'graphite',
  surfaceStyle: 'soft',
  density: 'comfortable',
  tabbarStyle: 'floating',
  portalLayout: 'overview',
  motionEnabled: true,
}

type ThemePresetPalette = {
  accent: string
  accentPressed: string
  accentSoft: string
  success: string
  warning: string
  danger: string
}

const lightPresetPaletteMap: Record<AppThemePresetId, ThemePresetPalette> = {
  graphite: {
    accent: '#1f2937',
    accentPressed: '#111827',
    accentSoft: '#edf2f7',
    success: '#0f766e',
    warning: '#b45309',
    danger: '#dc2626',
  },
  ocean: {
    accent: '#0a6fa9',
    accentPressed: '#075985',
    accentSoft: '#e0f2fe',
    success: '#0d9488',
    warning: '#c2410c',
    danger: '#dc2626',
  },
  forest: {
    accent: '#2f6f45',
    accentPressed: '#25583a',
    accentSoft: '#e9f6ec',
    success: '#15803d',
    warning: '#a16207',
    danger: '#b91c1c',
  },
  sunset: {
    accent: '#c2410c',
    accentPressed: '#9a3412',
    accentSoft: '#fff1e8',
    success: '#0f766e',
    warning: '#b45309',
    danger: '#dc2626',
  },
}

const darkPresetPaletteMap: Record<AppThemePresetId, ThemePresetPalette> = {
  graphite: {
    accent: '#cbd5e1',
    accentPressed: '#e2e8f0',
    accentSoft: '#273244',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
  },
  ocean: {
    accent: '#7dd3fc',
    accentPressed: '#bae6fd',
    accentSoft: '#102b3a',
    success: '#5eead4',
    warning: '#fdba74',
    danger: '#fda4af',
  },
  forest: {
    accent: '#86efac',
    accentPressed: '#bbf7d0',
    accentSoft: '#1d3225',
    success: '#4ade80',
    warning: '#facc15',
    danger: '#fda4af',
  },
  sunset: {
    accent: '#fdba74',
    accentPressed: '#fed7aa',
    accentSoft: '#3c2719',
    success: '#5eead4',
    warning: '#facc15',
    danger: '#fda4af',
  },
}

const resolveSystemThemeMode = (): Exclude<AppThemeMode, 'auto'> => {
  try {
    const theme = uni.getSystemInfoSync().theme
    return theme === 'dark' ? 'dark' : 'light'
  }
  catch {
    return 'light'
  }
}

const normalizeAppPreferences = (input?: Partial<UserAppPreferences> | null): UserAppPreferences => {
  const themePresetId = APP_THEME_PRESET_IDS.includes(input?.themePresetId as AppThemePresetId)
    ? (input?.themePresetId as AppThemePresetId)
    : defaultAppPreferences.themePresetId
  const themeMode = APP_THEME_MODES.includes(input?.themeMode as AppThemeMode)
    ? (input?.themeMode as AppThemeMode)
    : defaultAppPreferences.themeMode

  return {
    ...defaultAppPreferences,
    ...input,
    themeMode,
    themePresetId,
  }
}

export const useUiStore = defineStore(
  'ui',
  () => {
    const preferences = ref<UserAppPreferences>({ ...defaultAppPreferences })
    const syncing = ref(false)

    const resolvedThemeMode = computed<Exclude<AppThemeMode, 'auto'>>(() => {
      return preferences.value.themeMode === 'auto'
        ? resolveSystemThemeMode()
        : preferences.value.themeMode
    })

    const rootCssVars = computed<Record<string, string>>(() => {
      const isDark = resolvedThemeMode.value === 'dark'
      const palette = isDark
        ? darkPresetPaletteMap[preferences.value.themePresetId]
        : lightPresetPaletteMap[preferences.value.themePresetId]

      const densityScale = preferences.value.density === 'compact' ? '0.86' : '1'
      const motionDuration = preferences.value.motionEnabled ? '220ms' : '1ms'
      const tabbarFloating = preferences.value.tabbarStyle === 'floating'

      return {
        '--app-bg': isDark ? '#0b1220' : '#eef3f8',
        '--app-bg-gradient-start': isDark ? '#111b2f' : '#f7fafc',
        '--app-bg-gradient-end': isDark ? '#0b1220' : '#edf3fa',
        '--app-surface': isDark ? '#111d32' : '#ffffff',
        '--app-surface-soft': isDark
          ? (preferences.value.surfaceStyle === 'glass' ? 'rgba(19, 30, 49, 0.78)' : '#17243b')
          : (preferences.value.surfaceStyle === 'glass' ? 'rgba(255, 255, 255, 0.85)' : '#f6f9fc'),
        '--app-surface-strong': isDark ? '#1a2b46' : '#ecf2f8',
        '--app-border': isDark ? '#253755' : '#d7e0ea',
        '--app-border-light': isDark ? '#314565' : '#e7edf4',
        '--app-border-strong': isDark ? '#4b6287' : '#b7c6d8',
        '--app-text': isDark ? '#f3f6fb' : '#111827',
        '--app-text-secondary': isDark ? '#d4deec' : '#344154',
        '--app-text-muted': isDark ? '#9fb0c8' : '#748399',
        '--app-accent': palette.accent,
        '--app-accent-pressed': palette.accentPressed,
        '--app-accent-soft': palette.accentSoft,
        '--app-success': palette.success,
        '--app-success-soft': isDark ? 'rgba(20, 184, 166, 0.18)' : '#ecfdf5',
        '--app-warning': palette.warning,
        '--app-warning-soft': isDark ? 'rgba(251, 191, 36, 0.2)' : '#fff7ed',
        '--app-danger': palette.danger,
        '--app-danger-soft': isDark ? 'rgba(248, 113, 113, 0.2)' : '#fef2f2',
        '--app-density-scale': densityScale,
        '--app-motion-duration': motionDuration,
        '--app-card-radius': preferences.value.density === 'compact' ? '22rpx' : '28rpx',
        '--app-card-shadow': isDark
          ? '0 14rpx 40rpx rgba(2, 8, 20, 0.42)'
          : '0 14rpx 36rpx rgba(15, 23, 42, 0.08)',
        '--app-tabbar-bg': tabbarFloating
          ? (isDark ? 'rgba(11, 18, 32, 0.82)' : 'rgba(255, 255, 255, 0.9)')
          : (isDark ? '#0f1a2e' : '#ffffff'),
        '--app-tabbar-border': isDark ? '#2f4366' : '#cdd8e6',
        '--app-tabbar-shadow': tabbarFloating
          ? (isDark ? '0 10rpx 36rpx rgba(0, 0, 0, 0.45)' : '0 10rpx 26rpx rgba(15, 23, 42, 0.12)')
          : 'none',
        '--app-tabbar-radius': tabbarFloating ? '34rpx' : '0rpx',
        '--app-tabbar-offset-x': tabbarFloating ? '18rpx' : '0rpx',
        '--app-tabbar-offset-y': tabbarFloating ? '10rpx' : '0rpx',
      }
    })

    const hydrateFromUserPreferences = (next?: Partial<UserAppPreferences> | null) => {
      preferences.value = normalizeAppPreferences(next)
    }

    const patchPreferences = (next: Partial<UserAppPreferences>) => {
      preferences.value = normalizeAppPreferences({
        ...preferences.value,
        ...next,
      })
    }

    const resetPreferences = () => {
      preferences.value = { ...defaultAppPreferences }
    }

    const persistPreferences = async () => {
      const payload = normalizeAppPreferences(preferences.value)
      preferences.value = payload
      syncing.value = true
      try {
        await appApi.auth.updatePreferences({ app: payload })
        return payload
      }
      finally {
        syncing.value = false
      }
    }

    return {
      preferences,
      rootCssVars,
      resolvedThemeMode,
      syncing,
      hydrateFromUserPreferences,
      patchPreferences,
      resetPreferences,
      persistPreferences,
    }
  },
  {
    persist: true,
  },
)

