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
        <el-segmented
          :model-value="workbench.layoutMode"
          :options="layoutOptions"
          @change="onLayoutChange"
        />
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
import { useWorkbenchStore, type WorkbenchLayoutMode } from '@/stores/workbench';

const route = useRoute();
const workbench = useWorkbenchStore();

const layoutOptions = [
  { label: '侧边栏', value: 'sidebar' },
  { label: '顶部标签', value: 'tabs' },
];

const currentTheme = computed(() => findThemePreset(workbench.themePresetId));

const onLayoutChange = (value: string | number | boolean) => {
  workbench.setLayoutMode(value as WorkbenchLayoutMode);
};
</script>
