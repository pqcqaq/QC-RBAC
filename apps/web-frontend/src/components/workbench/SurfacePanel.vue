<template>
  <article class="surface-card surface-panel">
    <header v-if="$slots.header || caption || title || description || $slots.actions" class="surface-panel__header">
      <div class="surface-panel__copy">
        <slot name="header">
          <p v-if="caption" class="panel-caption">{{ caption }}</p>
          <h3 v-if="title" class="panel-heading" :class="headingClass">{{ title }}</h3>
          <p v-if="description" class="muted">{{ description }}</p>
        </slot>
      </div>

      <div v-if="$slots.actions" class="surface-panel__actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="surface-panel__body">
      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  caption?: string;
  title?: string;
  description?: string;
  size?: 'md' | 'lg';
}>(), {
  caption: undefined,
  title: undefined,
  description: undefined,
  size: 'lg',
});

const headingClass = computed(() => props.size === 'md' ? 'panel-heading--md' : 'panel-heading--lg');
</script>
