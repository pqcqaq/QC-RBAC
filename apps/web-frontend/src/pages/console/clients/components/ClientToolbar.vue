<template>
  <el-form label-position="top" class="page-toolbar">
    <el-form-item label="关键词" class="page-toolbar__field page-toolbar__field--wide">
      <el-input
        v-model="filters.q"
        clearable
        placeholder="编码 / 名称 / 描述"
        @keyup.enter="emit('apply')"
      />
    </el-form-item>

    <el-form-item label="客户端类型" class="page-toolbar__field">
      <el-select v-model="filters.type" clearable placeholder="全部类型">
        <el-option label="Web" :value="AuthClientType.WEB" />
        <el-option label="微信小程序" :value="AuthClientType.UNI_WECHAT_MINIAPP" />
        <el-option label="App" :value="AuthClientType.APP" />
      </el-select>
    </el-form-item>

    <el-form-item label="状态" class="page-toolbar__field">
      <el-select v-model="filters.enabled" clearable placeholder="全部状态">
        <el-option label="启用" value="enabled" />
        <el-option label="禁用" value="disabled" />
      </el-select>
    </el-form-item>

    <div class="page-toolbar__actions">
      <el-button @click="emit('reset')">重置</el-button>
      <el-button type="primary" plain @click="emit('apply')">查询</el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { AuthClientType } from '@rbac/api-common';

defineProps<{
  filters: {
    q: string;
    type: '' | AuthClientType;
    enabled: '' | 'enabled' | 'disabled';
  };
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();
</script>
