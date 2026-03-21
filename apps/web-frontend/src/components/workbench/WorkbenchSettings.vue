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
            @click="workbench.setThemePreset(preset.id)"
          >
            <div class="theme-preset-card__swatches">
              <span :style="{ background: preset.tokens['--accent'] }" />
              <span :style="{ background: preset.tokens['--sidebar-bg'] }" />
              <span :style="{ background: preset.tokens['--surface-2'] }" />
            </div>
            <strong>{{ preset.label }}</strong>
            <small>{{ preset.description }}</small>
          </button>
        </div>
      </section>

      <section class="settings-section">
        <header>
          <h4>工作台缓存</h4>
          <span>打开过的标签、主题与筛选条件会持久化到 localStorage。</span>
        </header>
        <div class="settings-kv-list">
          <div>
            <span>当前主题</span>
            <strong>{{ currentTheme?.label ?? '-' }}</strong>
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
        </div>
        <el-button @click="workbench.resetWorkbenchPreferences(route.path)">恢复默认</el-button>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { findThemePreset, themePresets } from '@/themes';
import type { SidebarAppearance } from '@/themes';
import { useWorkbenchStore, type WorkbenchLayoutMode } from '@/stores/workbench';

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

const currentTheme = computed(() => findThemePreset(workbench.themePresetId));

const isLayoutMode = (value: string | number | boolean): value is WorkbenchLayoutMode =>
  value === 'sidebar' || value === 'tabs';

const onLayoutChange = (value: string | number | boolean) => {
  if (isLayoutMode(value)) {
    workbench.setLayoutMode(value);
  }
};
</script>
