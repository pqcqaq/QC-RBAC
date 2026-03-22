<template>
  <ClientWebConfigFields
    v-if="type === AuthClientType.WEB"
    :config="config"
  />
  <ClientMiniappConfigFields
    v-else-if="type === AuthClientType.UNI_WECHAT_MINIAPP"
    :config="config"
  />
  <ClientAppConfigFields
    v-else
    :config="config"
  />
</template>

<script setup lang="ts">
import { AuthClientType } from '@rbac/api-common';
import type { ClientEditorConfigForm } from '../client-management';
import ClientAppConfigFields from './ClientAppConfigFields.vue';
import ClientMiniappConfigFields from './ClientMiniappConfigFields.vue';
import ClientWebConfigFields from './ClientWebConfigFields.vue';

defineProps<{
  type: AuthClientType;
  config: ClientEditorConfigForm;
}>();
</script>
