<template>
  <el-form-item label="协议">
    <el-select v-model="config.protocol">
      <el-option label="HTTP" value="http" />
      <el-option label="HTTPS" value="https" />
    </el-select>
  </el-form-item>

  <el-form-item label="域名">
    <el-input v-model="config.host" placeholder="例如 localhost 或 console.example.com" />
  </el-form-item>

  <el-form-item label="端口" class="page-form-grid__full">
    <el-input v-model="config.port" placeholder="留空表示协议默认端口" />
  </el-form-item>
</template>

<script setup lang="ts">
defineProps<{
  config: {
    protocol: 'http' | 'https';
    host: string;
    port: string;
  };
}>();
</script>
