<template>
  <article class="metric-card">
    <p class="metric-label">{{ label }}</p>
    <div class="metric-value-row">
      <strong>{{ value }}</strong>
    </div>
  </article>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
}>();
</script>
