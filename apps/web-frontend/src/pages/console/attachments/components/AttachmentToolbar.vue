<template>
  <el-form label-position="top" class="page-toolbar">
    <el-form-item label="关键词" class="page-toolbar__field page-toolbar__field--wide">
      <el-input
        v-model="filters.q"
        clearable
        placeholder="文件名 / MIME / 上传人"
        @keyup.enter="emit('apply')"
      />
    </el-form-item>

    <el-form-item label="类型" class="page-toolbar__field">
      <el-select v-model="filters.kind" clearable placeholder="全部类型">
        <el-option label="附件" value="attachment" />
        <el-option label="头像" value="avatar" />
      </el-select>
    </el-form-item>

    <el-form-item label="状态" class="page-toolbar__field">
      <el-select v-model="filters.uploadStatus" clearable placeholder="全部状态">
        <el-option label="已完成" value="COMPLETED" />
        <el-option label="上传中" value="PENDING" />
        <el-option label="失败" value="FAILED" />
      </el-select>
    </el-form-item>

    <el-form-item label="Tag1" class="page-toolbar__field">
      <el-input
        v-model="filters.tag1"
        clearable
        placeholder="精确匹配"
        @keyup.enter="emit('apply')"
      />
    </el-form-item>

    <el-form-item label="Tag2" class="page-toolbar__field">
      <el-input
        v-model="filters.tag2"
        clearable
        placeholder="精确匹配"
        @keyup.enter="emit('apply')"
      />
    </el-form-item>

    <div class="page-toolbar__actions">
      <el-button @click="emit('reset')">重置</el-button>
      <el-button type="primary" plain @click="emit('apply')">查询</el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import type { AttachmentFilters } from '../attachment-management';

defineProps<{
  filters: AttachmentFilters;
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();
</script>
