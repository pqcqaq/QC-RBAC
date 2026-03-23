<template>
  <div
    class="theme-mode-switch"
    :class="[
      `is-${size}`,
      {
        'shows-labels': showLabels,
      },
    ]"
    role="tablist"
    aria-label="界面明暗模式"
  >
    <span class="theme-mode-switch__indicator" :style="indicatorStyle" />

    <button
      v-for="option in themeModeOptions"
      :key="option.value"
      type="button"
      class="theme-mode-switch__option"
      :class="{ 'is-active': option.value === modelValue }"
      :title="resolveOptionTitle(option.value)"
      :aria-label="resolveOptionTitle(option.value)"
      :aria-pressed="option.value === modelValue"
      @click="handleSelect(option.value, $event)"
    >
      <UnoIcon :name="option.icon" :size="size === 'compact' ? 15 : 16" />
      <span v-if="showLabels" class="theme-mode-switch__label">{{ option.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UnoIcon from '@/components/common/UnoIcon.vue';
import { getThemeModeLabel, themeModeOptions, type ResolvedThemeMode, type ThemeMode } from '@/themes';

const props = withDefaults(defineProps<{
  modelValue: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  showLabels?: boolean;
  size?: 'default' | 'compact';
}>(), {
  showLabels: true,
  size: 'default',
});

const emit = defineEmits<{
  'update:modelValue': [value: ThemeMode];
  select: [payload: { value: ThemeMode; trigger: HTMLElement | null }];
}>();

const activeIndex = computed(() => themeModeOptions.findIndex((option) => option.value === props.modelValue));
const indicatorStyle = computed(() => ({
  transform: `translateX(calc(${Math.max(activeIndex.value, 0)} * 100%))`,
}));

const resolveOptionTitle = (value: ThemeMode) => {
  if (value !== 'auto') {
    return getThemeModeLabel(value);
  }

  return `自动（当前 ${getThemeModeLabel(props.resolvedMode)}）`;
};

const handleSelect = (value: ThemeMode, event: MouseEvent) => {
  if (value === props.modelValue) {
    return;
  }

  const trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  emit('update:modelValue', value);
  emit('select', { value, trigger });
};
</script>

<style scoped lang="scss">
.theme-mode-switch {
  --theme-switch-height: 40px;
  --theme-switch-padding: 4px;
  --theme-switch-indicator-bg: color-mix(in srgb, var(--surface-0) 92%, var(--accent) 8%);
  --theme-switch-indicator-shadow: 0 10px 18px rgba(var(--accent-rgb), 0.16);
  --theme-switch-button-color: var(--ink-3);
  --theme-switch-button-active: var(--ink-1);
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  min-width: 120px;
  height: var(--theme-switch-height);
  padding: var(--theme-switch-padding);
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-0) 78%, var(--surface-1));
  box-shadow: var(--shadow-panel);
  isolation: isolate;
}

.theme-mode-switch.is-compact {
  --theme-switch-height: 38px;
  min-width: 126px;
  border-radius: 13px;
}

.theme-mode-switch__indicator {
  position: absolute;
  inset: var(--theme-switch-padding);
  width: calc((100% - (var(--theme-switch-padding) * 2)) / 3);
  border-radius: 11px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface-0)) 0%, var(--theme-switch-indicator-bg) 100%);
  box-shadow: var(--theme-switch-indicator-shadow);
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), background 0.24s ease, box-shadow 0.24s ease;
}

.theme-mode-switch__option {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--theme-switch-button-color);
  cursor: pointer;
  transition: color 0.22s ease, transform 0.18s ease;
}

.theme-mode-switch__option:hover {
  color: var(--ink-2);
  transform: translateY(-1px);
}

.theme-mode-switch__option.is-active {
  color: var(--theme-switch-button-active);
}

.theme-mode-switch__label {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.theme-mode-switch.is-compact .theme-mode-switch__option {
  gap: 0;
}

@media (max-width: 760px) {
  .theme-mode-switch {
    min-width: 112px;
  }

  .theme-mode-switch.shows-labels {
    min-width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .theme-mode-switch__indicator,
  .theme-mode-switch__option {
    transition: none;
  }
}
</style>
