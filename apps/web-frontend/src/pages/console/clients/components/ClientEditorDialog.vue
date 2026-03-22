<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="760px"
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-position="top" class="page-form-grid">
      <el-form-item label="客户端编码">
        <el-input v-model="form.code" />
      </el-form-item>

      <el-form-item label="客户端名称">
        <el-input v-model="form.name" />
      </el-form-item>

      <el-form-item label="客户端类型">
        <el-select v-model="form.type">
          <el-option label="Web" :value="AuthClientType.WEB" />
          <el-option label="微信小程序" :value="AuthClientType.UNI_WECHAT_MINIAPP" />
          <el-option label="App" :value="AuthClientType.APP" />
        </el-select>
      </el-form-item>

      <el-form-item label="状态">
        <el-switch
          v-model="form.enabled"
          inline-prompt
          active-text="启用"
          inactive-text="禁用"
        />
      </el-form-item>

      <el-form-item label="描述" class="page-form-grid__full">
        <el-input v-model="form.description" type="textarea" :rows="3" maxlength="120" show-word-limit />
      </el-form-item>

      <el-form-item label="Client Secret" class="page-form-grid__full">
        <el-input
          v-model="form.clientSecret"
          show-password
          :placeholder="isEditing ? '留空表示不变更当前 secret' : '不少于 16 位'"
        />
      </el-form-item>

      <el-divider class="page-form-grid__full" content-position="left">客户端配置</el-divider>

      <ClientConfigFields
        :type="form.type"
        :config="form.config"
      />
    </el-form>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="emit('save')">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { AuthClientType } from '@rbac/api-common';
import type { ClientEditorForm } from '../client-management';
import ClientConfigFields from './ClientConfigFields.vue';

defineProps<{
  visible: boolean;
  title: string;
  isEditing: boolean;
  form: ClientEditorForm;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save: [];
}>();
</script>
