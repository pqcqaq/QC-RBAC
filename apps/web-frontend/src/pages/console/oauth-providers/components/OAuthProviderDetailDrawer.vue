<template>
  <el-drawer
    :model-value="visible"
    title="OAuth 供应商详情"
    size="560px"
    @update:model-value="emit('update:visible', $event)"
  >
    <template v-if="provider">
      <section class="surface-card oauth-detail-card">
        <p class="panel-caption">Provider</p>
        <h3 class="panel-heading panel-heading--md">{{ provider.name }}</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="编码">{{ provider.code }}</el-descriptions-item>
          <el-descriptions-item label="协议">{{ resolveOAuthProviderProtocolLabel(provider.protocol) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-space>
              <el-tag :type="provider.enabled ? 'success' : 'info'" effect="light" round>
                {{ provider.enabled ? '启用' : '禁用' }}
              </el-tag>
              <el-tag :type="provider.allowLogin ? 'success' : 'warning'" effect="light" round>
                {{ provider.allowLogin ? '允许登录' : '不允许登录' }}
              </el-tag>
            </el-space>
          </el-descriptions-item>
          <el-descriptions-item label="描述">{{ provider.description || '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(provider.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatTime(provider.updatedAt) }}</el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="surface-card oauth-detail-card">
        <p class="panel-caption">Config</p>
        <h3 class="panel-heading panel-heading--md">接入配置</h3>
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
import type { OAuthProviderRecord } from '@rbac/api-common';
import { formatTime } from '../../oauth/oauth-management';
import {
  buildOAuthProviderDetailEntries,
  resolveOAuthProviderProtocolLabel,
} from '../provider-management';

const props = defineProps<{
  visible: boolean;
  provider: OAuthProviderRecord | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const detailEntries = computed(() => (props.provider ? buildOAuthProviderDetailEntries(props.provider) : []));
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
