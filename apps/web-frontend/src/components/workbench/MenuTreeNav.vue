<template>
  <template v-for="item in items" :key="item.id">
    <el-sub-menu
      v-if="item.type === 'DIRECTORY' && item.children.length"
      :index="`directory:${item.id}`"
    >
      <template #title>
        <div class="menu-icon" :title="item.code">
          <UnoIcon :name="resolveMenuNodeIcon(item)" :title="item.title" :size="18" />
        </div>
        <div class="menu-copy">
          <div class="menu-copy__title">{{ item.title }}</div>
          <small>{{ item.caption || item.description || '目录节点' }}</small>
        </div>
      </template>

      <MenuTreeNav :items="item.children" />
    </el-sub-menu>

    <el-menu-item
      v-else-if="item.type === 'PAGE' && item.path"
      :index="item.path"
    >
      <div class="menu-icon" :title="item.code">
        <UnoIcon :name="resolveMenuNodeIcon(item)" :title="item.title" :size="18" />
      </div>
      <div class="menu-copy">
        <div class="menu-copy__title">{{ item.title }}</div>
        <small>{{ item.caption || item.description || '页面节点' }}</small>
      </div>
    </el-menu-item>
  </template>
</template>

<script setup lang="ts">
import type { MenuNodeRecord } from '@rbac/api-common';
import UnoIcon from '@/components/common/UnoIcon.vue';
import { resolveMenuNodeIcon } from '@/components/common/uno-icons';

defineOptions({ name: 'MenuTreeNav' });

defineProps<{
  items: MenuNodeRecord[];
}>();
</script>

<style scoped lang="scss">
.menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: inherit;
  flex: 0 0 36px;
}

.menu-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  min-width: 0;
}

.menu-copy__title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.15;
}

.menu-copy small {
  display: block;
  font-size: 11px;
  line-height: 1.2;
}
</style>
