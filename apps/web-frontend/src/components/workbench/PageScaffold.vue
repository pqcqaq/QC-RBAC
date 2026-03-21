<template>
  <section class="page-scaffold">
    <header v-if="$slots.actions" class="page-scaffold__header">
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
type StatItem = {
  label: string;
  value: string | number;
};

const props = withDefaults(defineProps<{
  stats?: StatItem[];
}>(), {
  stats: () => [],
});
</script>

