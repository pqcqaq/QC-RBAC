import { ref } from 'vue'

const theme = ref<'light' | 'dark'>('light')

const themeVars = {
  colorTheme: '#111827',
  colorSuccess: '#0f766e',
  colorWarning: '#b45309',
  colorDanger: '#dc2626',
  colorTitle: '#111827',
  colorContent: '#374151',
  colorSecondary: '#6b7280',
  colorAid: '#8b96a6',
  colorTip: '#9ca3af',
  colorBorder: '#dde3eb',
  colorBorderLight: '#edf1f5',
  colorBg: '#f5f7fa',
  buttonLargeHeight: '48px',
  buttonMediumHeight: '40px',
  buttonLargeRadius: '16px',
  buttonMediumRadius: '12px',
  buttonPrimaryBgColor: '#111827',
  buttonPrimaryColor: '#ffffff',
  buttonInfoBgColor: '#f3f4f6',
  buttonInfoColor: '#111827',
  cellGroupPadding: '0 16px 12px',
  cellGroupTitleColor: '#6b7280',
  cellTitleColor: '#111827',
  cellLabelColor: '#8b96a6',
  cellValueColor: '#4b5563',
  cellWrapperPadding: '16px 16px',
  cellWrapperPaddingLarge: '18px 16px',
  cellTapBg: '#fafbfc',
  inputColor: '#111827',
  inputPlaceholderColor: '#a8b0bb',
  inputBorderColor: '#dde3eb',
  inputNotEmptyBorderColor: '#111827',
  inputCellBorderColor: '#edf1f5',
  inputCellPadding: '14px 0',
  inputCellPaddingLarge: '16px 0',
  inputBg: '#ffffff',
  inputCellBg: '#ffffff',
  statustipColor: '#8b96a6',
  loadmoreColor: '#8b96a6',
  avatarBgColor: '#e5e7eb',
  avatarBorderRadius: '18px',
  tagRoundRadius: '10px',
  tagFs: '12px',
  tagColor: '#4b5563',
  navbarBackground: '#f5f7fa',
  navbarColor: '#111827',
}

export function useAppTheme() {
  return {
    theme,
    themeVars,
  }
}
