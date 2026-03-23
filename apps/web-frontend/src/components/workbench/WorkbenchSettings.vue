<template>
  <el-drawer
    :model-value="workbench.settingsVisible"
    title="工作台设置"
    size="420px"
    @close="workbench.closeSettings"
  >
    <div class="settings-panel">
      <section class="settings-section">
        <header>
          <h4>布局方式</h4>
          <span>切换左侧导航或浏览器式标签布局。</span>
        </header>
        <el-segmented class="settings-segmented" :model-value="workbench.layoutMode" :options="layoutOptions" @change="onLayoutChange" />
      </section>

      <section class="settings-section">
        <header>
          <h4>界面模式</h4>
          <span>每个主题预设都支持亮色和暗色，可固定，也可跟随系统。</span>
        </header>
        <ThemeModeSwitch
          :model-value="workbench.themeMode"
          :resolved-mode="workbench.resolvedThemeMode"
          @select="handleThemeModeSelect"
        />
      </section>

      <section class="settings-section">
        <header>
          <h4>侧栏风格</h4>
          <span>暗色更聚焦导航，亮色更贴近整体面板。切换后会同步适配菜单、激活态和文案对比度。</span>
        </header>
        <div class="settings-mode-grid">
          <button
            v-for="option in sidebarAppearanceOptions"
            :key="option.value"
            type="button"
            class="settings-mode-card"
            :class="{ 'is-active': option.value === workbench.sidebarAppearance }"
            @click="workbench.setSidebarAppearance(option.value)"
          >
            <div class="settings-mode-card__preview" :class="`is-${option.value}`">
              <span />
              <span />
              <span />
            </div>
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </button>
        </div>
      </section>

      <section class="settings-section">
        <header>
          <h4>切换动画</h4>
          <span>控制主内容区在页面切换时的过渡效果，保持切换反馈但不过度打扰。</span>
        </header>
        <div class="settings-mode-grid settings-mode-grid--triple">
          <button
            v-for="option in pageTransitionOptions"
            :key="option.value"
            type="button"
            class="settings-mode-card"
            :class="{ 'is-active': option.value === workbench.pageTransition }"
            @click="workbench.setPageTransition(option.value)"
          >
            <div class="settings-mode-card__preview" :class="`is-transition-${option.value}`">
              <span />
              <span />
              <span />
            </div>
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </button>
        </div>
      </section>

      <section class="settings-section">
        <header>
          <h4>缓存标签</h4>
          <span>控制侧栏布局下缓存标签条的显示方式，可完全隐藏，也可切换为更接近浏览器的标签感。</span>
        </header>
        <div class="settings-mode-grid settings-mode-grid--triple">
          <button
            v-for="option in cachedTabDisplayOptions"
            :key="option.value"
            type="button"
            class="settings-mode-card"
            :class="{ 'is-active': option.value === workbench.cachedTabDisplayMode }"
            @click="workbench.setCachedTabDisplayMode(option.value)"
          >
            <div class="settings-mode-card__preview" :class="`is-tabs-${option.value}`">
              <span />
              <span />
              <span />
            </div>
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </button>
        </div>
      </section>

      <section class="settings-section">
        <header>
          <h4>主题方案</h4>
          <span>主题预设由 `themes/presets/*.json` 统一生成，可继续扩展。</span>
        </header>
        <div class="theme-preset-grid">
          <button
            v-for="preset in themePresets"
            :key="preset.id"
            type="button"
            class="theme-preset-card"
            :class="{ 'is-active': preset.id === workbench.themePresetId }"
            @click="handleThemePresetSelect(preset.id, $event)"
          >
            <div class="theme-preset-card__swatches">
              <div class="theme-preset-card__mode">
                <small>亮</small>
                <div class="theme-preset-card__mode-swatches">
                  <span :style="{ background: getPresetSwatch(preset, 'light', '--accent') }" />
                  <span :style="{ background: getPresetSwatch(preset, 'light', '--surface-2') }" />
                </div>
              </div>
              <div class="theme-preset-card__mode is-dark">
                <small>暗</small>
                <div class="theme-preset-card__mode-swatches">
                  <span :style="{ background: getPresetSwatch(preset, 'dark', '--accent') }" />
                  <span :style="{ background: getPresetSwatch(preset, 'dark', '--surface-2') }" />
                </div>
              </div>
            </div>
            <strong>{{ preset.label }}</strong>
            <small>{{ preset.description }}</small>
          </button>
        </div>
      </section>

      <section class="settings-section">
        <header>
          <h4>工作台缓存</h4>
          <span>主题、标签和筛选会跟随当前账号保存。</span>
        </header>
        <div class="settings-kv-list">
          <div>
            <span>当前主题</span>
            <strong>{{ currentTheme?.label ?? '-' }}</strong>
          </div>
          <div>
            <span>界面模式</span>
            <strong>{{ currentThemeModeLabel }}</strong>
          </div>
          <div>
            <span>侧栏风格</span>
            <strong>{{ workbench.sidebarAppearance === 'dark' ? '暗色' : '亮色' }}</strong>
          </div>
          <div>
            <span>缓存标签</span>
            <strong>{{ workbench.visitedTabs.length }}</strong>
          </div>
          <div>
            <span>缓存视图</span>
            <strong>{{ workbench.cachedViewNames.length }}</strong>
          </div>
          <div>
            <span>布局模式</span>
            <strong>{{ workbench.layoutMode === 'sidebar' ? '侧栏' : '标签' }}</strong>
          </div>
          <div>
            <span>切换动画</span>
            <strong>{{ currentPageTransitionLabel }}</strong>
          </div>
          <div>
            <span>标签样式</span>
            <strong>{{ currentCachedTabDisplayLabel }}</strong>
          </div>
        </div>
        <el-button @click="workbench.resetWorkbenchPreferences(route.path)">恢复默认</el-button>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ThemeModeSwitch from '@/components/workbench/ThemeModeSwitch.vue';
import {
  findThemePreset,
  getThemeModeLabel,
  themePresets,
  type SidebarAppearance,
  type ThemeMode,
  type ThemePreset,
} from '@/themes';
import {
  useWorkbenchStore,
  type CachedTabDisplayMode,
  type PageTransitionMode,
  type WorkbenchLayoutMode,
} from '@/stores/workbench';

const route = useRoute();
const workbench = useWorkbenchStore();

const layoutOptions = [
  { label: '侧边栏', value: 'sidebar' },
  { label: '顶部标签', value: 'tabs' },
];

const sidebarAppearanceOptions = [
  { label: '暗色侧栏', value: 'dark', description: '更强对比，更聚焦导航层级。' },
  { label: '亮色侧栏', value: 'light', description: '更轻盈，和主内容区更统一。' },
] satisfies Array<{ label: string; value: SidebarAppearance; description: string }>;

const pageTransitionOptions = [
  { label: '无动画', value: 'none', description: '立即切换，适合更克制的操作反馈。' },
  { label: '淡入淡出', value: 'fade', description: '轻量过渡，兼顾稳定感和节奏感。' },
  { label: '横向滑动', value: 'slide', description: '切换方向更明确，页面层次更清晰。' },
] satisfies Array<{ label: string; value: PageTransitionMode; description: string }>;

const cachedTabDisplayOptions = [
  { label: '关闭', value: 'hidden', description: '不显示缓存标签条，header 保持更简洁。' },
  { label: '标准', value: 'classic', description: '沿用当前的轻量胶囊式标签表现。' },
  { label: '浏览器', value: 'browser', description: '更像浏览器页签，层次更鲜明。' },
] satisfies Array<{ label: string; value: CachedTabDisplayMode; description: string }>;

const currentTheme = computed(() => findThemePreset(workbench.themePresetId));
const currentThemeModeLabel = computed(() => {
  if (workbench.themeMode !== 'auto') {
    return getThemeModeLabel(workbench.themeMode);
  }

  return `自动·${getThemeModeLabel(workbench.resolvedThemeMode)}`;
});
const currentPageTransitionLabel = computed(
  () => pageTransitionOptions.find((option) => option.value === workbench.pageTransition)?.label ?? '淡入淡出',
);
const currentCachedTabDisplayLabel = computed(
  () => cachedTabDisplayOptions.find((option) => option.value === workbench.cachedTabDisplayMode)?.label ?? '标准',
);

const isLayoutMode = (value: string | number | boolean): value is WorkbenchLayoutMode =>
  value === 'sidebar' || value === 'tabs';

const onLayoutChange = (value: string | number | boolean) => {
  if (isLayoutMode(value)) {
    workbench.setLayoutMode(value);
  }
};

const handleThemeModeSelect = (payload: { value: ThemeMode; trigger: HTMLElement | null }) => {
  workbench.setThemeMode(payload.value, {
    animate: true,
    origin: payload.trigger,
  });
};

const handleThemePresetSelect = (themePresetId: string, event: MouseEvent) => {
  const trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  workbench.setThemePreset(themePresetId, {
    animate: true,
    origin: trigger,
  });
};

const getPresetSwatch = (
  preset: ThemePreset,
  mode: 'light' | 'dark',
  token: string,
) => {
  const tokens = mode === 'dark' ? preset.darkTokens : preset.lightTokens;
  return tokens[token] ?? (token === '--accent' ? 'var(--accent)' : 'var(--surface-2)');
};
</script>

