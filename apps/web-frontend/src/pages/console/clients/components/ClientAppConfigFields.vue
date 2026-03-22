<template>
  <el-form-item label="包名">
    <el-input v-model="config.packageName" placeholder="例如 com.example.rbac" />
  </el-form-item>

  <el-form-item label="平台">
    <el-input v-model="config.platform" placeholder="例如 android / ios，可选" />
  </el-form-item>
</template>

<script setup lang="ts">
defineProps<{
  config: {
    packageName: string;
    platform: string;
  };
}>();
</script>
