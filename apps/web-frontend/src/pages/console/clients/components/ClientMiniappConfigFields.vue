<template>
  <el-form-item label="AppID">
    <el-input v-model="config.appId" placeholder="微信小程序 AppID" />
  </el-form-item>

  <el-form-item label="AppSecret">
    <el-input v-model="config.appSecret" show-password placeholder="微信小程序 AppSecret" />
  </el-form-item>
</template>

<script setup lang="ts">
defineProps<{
  config: {
    appId: string;
    appSecret: string;
  };
}>();
</script>
