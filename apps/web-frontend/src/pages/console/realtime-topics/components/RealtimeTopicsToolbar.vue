<template>
  <el-form label-position="top" class="page-toolbar">
    <el-form-item label="关键词" class="page-toolbar__field page-toolbar__field--wide">
      <el-input
        v-model="filters.q"
        clearable
        placeholder="编码 / 名称 / Topic Pattern / 权限"
        @keyup.enter="emit('apply')"
      />
    </el-form-item>

    <el-form-item label="来源" class="page-toolbar__field">
      <el-select v-model="filters.sourceType" clearable placeholder="全部来源">
        <el-option label="系统注册" value="seed" />
        <el-option label="自定义绑定" value="custom" />
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
    sourceType: '' | 'seed' | 'custom';
  };
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();
</script>
