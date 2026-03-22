<template>
  <el-drawer
    :model-value="visible"
    title="OAuth 应用详情"
    size="600px"
    @update:model-value="emit('update:visible', $event)"
  >
    <template v-if="application">
      <section class="surface-card oauth-detail-card">
        <p class="panel-caption">Application</p>
        <h3 class="panel-heading panel-heading--md">{{ application.name }}</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="编码">{{ application.code }}</el-descriptions-item>
          <el-descriptions-item label="类型">
            {{ resolveOAuthApplicationClientTypeLabel(application.clientType) }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="application.enabled ? 'success' : 'info'" effect="light" round>
              {{ application.enabled ? '启用' : '禁用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="描述">{{ application.description || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(application.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatTime(application.updatedAt) }}</el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="surface-card oauth-detail-card">
        <p class="panel-caption">Config</p>
        <h3 class="panel-heading panel-heading--md">授权配置</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item
            v-for="item in detailEntries"
            :key="item.label"
            :label="item.label"
          >
            <span class="oauth-detail-value">{{ item.value }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </section>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { OAuthApplicationRecord } from '@rbac/api-common';
import { formatTime } from '../../oauth/oauth-management';
import {
  buildOAuthApplicationDetailEntries,
  resolveOAuthApplicationClientTypeLabel,
} from '../application-management';

const props = defineProps<{
  visible: boolean;
  application: OAuthApplicationRecord | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const detailEntries = computed(() =>
  props.application ? buildOAuthApplicationDetailEntries(props.application) : [],
);
</script>

<style scoped>
.oauth-detail-card + .oauth-detail-card {
  margin-top: 16px;
}

.oauth-detail-value {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
