<template>
  <el-drawer
    :model-value="visible"
    title="客户端详情"
    size="520px"
    @update:model-value="emit('update:visible', $event)"
  >
    <template v-if="client">
      <section class="surface-card client-detail-card">
        <p class="panel-caption">Client</p>
        <h3 class="panel-heading panel-heading--md">{{ client.name }}</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="编码">{{ client.code }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ resolveClientTypeLabel(client.type) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="client.enabled ? 'success' : 'info'" effect="light" round>
              {{ client.enabled ? '启用' : '禁用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="描述">{{ client.description || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(client.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatTime(client.updatedAt) }}</el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="surface-card client-detail-card">
        <p class="panel-caption">Config</p>
        <h3 class="panel-heading panel-heading--md">类型配置</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item
            v-for="item in configEntries"
            :key="item.label"
            :label="item.label"
          >
            {{ item.value }}
          </el-descriptions-item>
        </el-descriptions>
      </section>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AuthClientRecord } from '@rbac/api-common';
import { buildClientConfigEntries, resolveClientTypeLabel } from '../client-management';

const props = defineProps<{
  visible: boolean;
  client: AuthClientRecord | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const formatTime = (value: string) => new Date(value).toLocaleString();

const configEntries = computed(() =>
  props.client ? buildClientConfigEntries(props.client) : [],
);
</script>

<style scoped>
.client-detail-card + .client-detail-card {
  margin-top: 16px;
}
</style>
