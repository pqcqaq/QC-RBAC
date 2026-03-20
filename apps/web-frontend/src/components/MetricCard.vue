<template>
  <article class="metric-card">
    <p class="metric-label">{{ label }}</p>
    <div class="metric-value-row">
      <strong>{{ value }}</strong>
      <span>{{ trend }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  trend: string;
}>();
</script>
