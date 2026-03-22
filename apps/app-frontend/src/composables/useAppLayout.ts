import { computed } from 'vue'
import { safeAreaInsets, systemInfo } from '@/utils/systemInfo'

const TABBAR_BASE_HEIGHT = 56

function resolveNavigationBarHeight(safeTop: number) {
  let navigationBarHeight = 44

  // #ifdef MP-WEIXIN
  const menuButtonRect = typeof uni.getMenuButtonBoundingClientRect === 'function'
    ? uni.getMenuButtonBoundingClientRect()
    : null

  if (menuButtonRect?.height) {
    const verticalGap = Math.max(menuButtonRect.top - safeTop, 4)
    navigationBarHeight = menuButtonRect.height + verticalGap * 2
  }
  // #endif

  // #ifndef MP-WEIXIN
  const platform = String(systemInfo?.platform || '').toLowerCase()
  navigationBarHeight = platform.includes('android') ? 48 : 44
  // #endif

  return navigationBarHeight
}

const safeTop = Number(systemInfo?.statusBarHeight || safeAreaInsets?.top || 0)
const safeBottom = Number(safeAreaInsets?.bottom || 0)
const navigationBarHeight = resolveNavigationBarHeight(safeTop)
const headerHeight = safeTop + navigationBarHeight
const tabbarHeight = TABBAR_BASE_HEIGHT + safeBottom

export const appLayoutMetrics = {
  safeTop,
  safeBottom,
  navigationBarHeight,
  headerHeight,
  tabbarBaseHeight: TABBAR_BASE_HEIGHT,
  tabbarHeight,
}

export function useAppLayout() {
  const rootCssVars = computed<Record<string, string>>(() => ({
    '--app-safe-top': `${appLayoutMetrics.safeTop}px`,
    '--app-safe-bottom': `${appLayoutMetrics.safeBottom}px`,
    '--app-nav-height': `${appLayoutMetrics.navigationBarHeight}px`,
    '--app-header-height': `${appLayoutMetrics.headerHeight}px`,
    '--app-tabbar-base-height': `${appLayoutMetrics.tabbarBaseHeight}px`,
    '--app-tabbar-height': `${appLayoutMetrics.tabbarHeight}px`,
  }))

  return {
    metrics: appLayoutMetrics,
    rootCssVars,
  }
}
