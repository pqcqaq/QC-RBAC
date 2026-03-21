<template>
  <el-form label-position="top" class="page-toolbar">
    <el-form-item label="关键词" class="page-toolbar__field page-toolbar__field--wide">
      <el-input
        v-model="filters.q"
        clearable
        placeholder="操作者 / 动作 / 目标"
        @keyup.enter="emit('apply')"
      />
    </el-form-item>

    <el-form-item label="动作" class="page-toolbar__field">
      <el-input
        v-model="filters.action"
        clearable
        placeholder="如 user.update"
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
defineProps<{
  filters: {
    q: string;
    action: string;
  };
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();
</script>
