<template>
  <div class="user-avatar-chip" :class="[`user-avatar-chip--${size}`]">
    <img v-if="avatarUrl" :src="avatarUrl" :alt="name" class="user-avatar-chip__image" />
    <span v-else class="user-avatar-chip__fallback">{{ initial }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  avatarUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}>(), {
  avatarUrl: null,
  size: 'md',
});

const initial = computed(() => props.name.trim().slice(0, 1).toUpperCase() || '?');
</script>

<style scoped lang="scss">
.user-avatar-chip {
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
  flex: 0 0 auto;
}

.user-avatar-chip--sm {
  width: 32px;
  height: 32px;
  font-size: 12px;
}

.user-avatar-chip--md {
  width: 40px;
  height: 40px;
  font-size: 14px;
}

.user-avatar-chip--lg {
  width: 56px;
  height: 56px;
  font-size: 18px;
}

.user-avatar-chip__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar-chip__fallback {
  line-height: 1;
}
</style>
