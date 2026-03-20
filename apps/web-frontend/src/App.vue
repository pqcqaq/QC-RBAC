<template>
  <el-config-provider
    :locale="zhCn"
    size="default"
    :button="buttonConfig"
    :link="linkConfig"
    :dialog="dialogConfig"
    :message="messageConfig"
    :table="tableConfig"
    :empty-values="emptyValues"
    :value-on-clear="null"
  >
    <div class="admin-theme">
      <router-view />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { onBeforeMount } from 'vue';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { useWorkbenchStore } from '@/stores/workbench';

const emptyValues = [null, undefined];
const workbench = useWorkbenchStore();

const buttonConfig = {
  autoInsertSpace: false,
};

const linkConfig = {
  underline: 'never' as const,
};

const dialogConfig = {
  draggable: true,
  overflow: true,
};

const messageConfig = {
  max: 3,
  grouping: true,
  showClose: true,
  duration: 2200,
  offset: 18,
  plain: true,
  placement: 'top-right' as const,
};

const tableConfig = {
  showOverflowTooltip: true,
  tooltipEffect: 'light' as const,
};

onBeforeMount(() => {
  workbench.bootstrap();
});
</script>
