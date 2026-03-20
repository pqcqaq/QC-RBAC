<template>
  <section class="page-scaffold">
    <header class="page-scaffold__header">
      <div class="page-scaffold__copy">
        <div class="page-scaffold__eyebrow">
          <span v-if="resolvedCode" class="page-scaffold__code">{{ resolvedCode }}</span>
          <span>{{ resolvedCaption }}</span>
        </div>
        <div class="page-scaffold__headline">
          <h3>{{ resolvedTitle }}</h3>
          <p class="page-scaffold__description">{{ resolvedDescription }}</p>
        </div>
      </div>

      <div v-if="$slots.actions" class="page-scaffold__actions">
        <slot name="actions" />
      </div>
    </header>

    <div v-if="stats.length" class="page-scaffold__stats">
      <article v-for="item in stats" :key="item.label" class="page-scaffold__stat">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
    </div>

    <div v-if="$slots.toolbar" class="page-scaffold__toolbar">
      <slot name="toolbar" />
    </div>

    <div class="page-scaffold__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

type StatItem = {
  label: string;
  value: string | number;
};

const props = withDefaults(defineProps<{
  title?: string;
  caption?: string;
  description?: string;
  code?: string;
  stats?: StatItem[];
}>(), {
  title: undefined,
  caption: undefined,
  description: undefined,
  code: undefined,
  stats: () => [],
});

const route = useRoute();
const readMeta = (key: 'title' | 'caption' | 'description' | 'code') => {
  const value = route.meta[key];
  return typeof value === 'string' ? value : '';
};

const resolvedTitle = computed(() => props.title || readMeta('title') || '控制台');
const resolvedCaption = computed(() => props.caption || readMeta('caption') || 'Workbench');
const resolvedDescription = computed(() => props.description || readMeta('description') || '');
const resolvedCode = computed(() => props.code || readMeta('code') || '');
const stats = computed(() => props.stats ?? []);
</script>

