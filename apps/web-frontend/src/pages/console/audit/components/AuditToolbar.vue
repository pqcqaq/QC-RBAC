<template>
  <el-form label-position="top" class="page-toolbar">
    <el-form-item label="关键词" class="page-toolbar__field page-toolbar__field--wide">
      <el-input
        v-model="filters.q"
        clearable
        placeholder="请求ID / 操作者 / 路径 / 模型 / 操作"
        @keyup.enter="emit('apply')"
      />
    </el-form-item>

    <el-form-item label="方法" class="page-toolbar__field">
      <el-select v-model="filters.method" clearable placeholder="全部方法">
        <el-option label="GET" value="GET" />
        <el-option label="POST" value="POST" />
        <el-option label="PUT" value="PUT" />
        <el-option label="DELETE" value="DELETE" />
      </el-select>
    </el-form-item>

    <el-form-item label="模型" class="page-toolbar__field">
      <el-input
        v-model="filters.model"
        clearable
        placeholder="如 User"
        @keyup.enter="emit('apply')"
      />
    </el-form-item>

    <el-form-item label="操作" class="page-toolbar__field">
      <el-input
        v-model="filters.operation"
        clearable
        placeholder="如 update / findMany"
        @keyup.enter="emit('apply')"
      />
    </el-form-item>

    <el-form-item label="结果" class="page-toolbar__field">
      <el-select v-model="filters.status" clearable placeholder="全部结果">
        <el-option label="成功" value="success" />
        <el-option label="失败" value="failure" />
      </el-select>
    </el-form-item>

    <div class="page-toolbar__actions">
      <el-button @click="emit('reset')">重置</el-button>
      <el-button type="primary" plain @click="emit('apply')">查询</el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
defineProps<{
  filters: {
    q: string;
    method: string;
    model: string;
    operation: string;
    status: string;
  };
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();
</script>
