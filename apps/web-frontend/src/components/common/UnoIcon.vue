<template>
  <Icon
    v-if="iconName"
    class="uno-icon"
    :icon="iconName"
    :title="title || undefined"
    :style="iconStyle"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import { Icon } from '@iconify/vue';
import { normalizeIconName } from './iconify-runtime';

defineOptions({ name: 'UnoIcon' });

const props = withDefaults(defineProps<{
  name?: string | null;
  fallback?: string | null;
  size?: number | string;
  title?: string;
}>(), {
  name: null,
  fallback: null,
  size: 18,
  title: '',
});

const iconClass = computed(() => {
  const directValue = props.name?.trim();
  if (directValue) {
    return directValue;
  }

  const fallbackValue = props.fallback?.trim();
  return fallbackValue || '';
});

const iconName = computed(() => {
  return normalizeIconName(iconClass.value);
});

const iconStyle = computed<CSSProperties>(() => {
  const sizeValue = typeof props.size === 'number' ? `${props.size}px` : props.size;
  return {
    fontSize: sizeValue,
  };
});
</script>

<style scoped lang="scss">
.uno-icon {
  display: inline-block;
  flex: 0 0 auto;
  line-height: 1;
}
</style>
