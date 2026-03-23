<template>
  <div class="uno-icon-picker">
    <button type="button" class="uno-icon-picker__trigger" @click="dialogVisible = true">
      <span class="uno-icon-picker__preview">
        <UnoIcon
          :name="selectedValue"
          :fallback="fallback || undefined"
          :title="selectedLabel"
          :size="22"
        />
      </span>

      <span class="uno-icon-picker__copy">
        <strong>{{ selectedLabel }}</strong>
        <small>{{ selectedValue || '未设置，将使用默认图标' }}</small>
      </span>

      <span class="uno-icon-picker__action">选择</span>
    </button>

    <el-dialog
      v-model="dialogVisible"
      title="选择菜单图标"
      width="860px"
      top="7vh"
      append-to-body
      class="uno-icon-picker__dialog"
    >
      <div class="uno-icon-picker__toolbar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索图标名、分组或 class"
        />

        <el-select v-model="selectedGroup" clearable placeholder="全部分组">
          <el-option
            v-for="group in groups"
            :key="group"
            :label="group"
            :value="group"
          />
        </el-select>
      </div>

      <div class="uno-icon-picker__current">
        <div class="uno-icon-picker__current-preview">
          <UnoIcon
            :name="selectedValue"
            :fallback="fallback || undefined"
            :title="selectedLabel"
            :size="28"
          />
        </div>

        <div class="uno-icon-picker__current-copy">
          <strong>{{ selectedLabel }}</strong>
          <span>{{ selectedValue || fallback || '未选择图标' }}</span>
        </div>

        <el-button
          v-if="selectedValue"
          plain
          @click="clearValue"
        >
          清空图标
        </el-button>
      </div>

      <el-scrollbar max-height="440px">
        <div v-if="filteredOptions.length" class="uno-icon-picker__grid">
          <button
            v-for="option in filteredOptions"
            :key="option.value"
            type="button"
            class="uno-icon-picker__item"
            :class="{ 'is-active': option.value === selectedValue }"
            @click="selectValue(option.value)"
          >
            <span class="uno-icon-picker__item-icon">
              <UnoIcon :name="option.value" :title="option.label" :size="22" />
            </span>

            <span class="uno-icon-picker__item-copy">
              <strong>{{ option.label }}</strong>
              <small>{{ option.value }}</small>
            </span>
          </button>
        </div>

        <el-empty v-else description="没有匹配的图标" />
      </el-scrollbar>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import UnoIcon from './UnoIcon.vue';
import type { UnoIconOption } from './uno-icons';
import { menuIconCatalog } from './uno-icons';

defineOptions({ name: 'UnoIconPicker' });

const props = withDefaults(defineProps<{
  modelValue?: string | null;
  fallback?: string | null;
  options?: UnoIconOption[];
}>(), {
  modelValue: null,
  fallback: null,
  options: () => menuIconCatalog,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const dialogVisible = ref(false);
const keyword = ref('');
const selectedGroup = ref<string | null>(null);

const selectedValue = computed(() => props.modelValue?.trim() || '');
const optionLookup = computed(() => new Map(props.options.map((item) => [item.value, item])));
const selectedOption = computed(() => optionLookup.value.get(selectedValue.value) ?? null);
const selectedLabel = computed(() => selectedOption.value?.label ?? (selectedValue.value ? '自定义图标' : '跟随默认图标'));
const groups = computed(() => Array.from(new Set(props.options.map((item) => item.group))));

const filteredOptions = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();

  return props.options.filter((option) => {
    if (selectedGroup.value && option.group !== selectedGroup.value) {
      return false;
    }

    if (!normalizedKeyword) {
      return true;
    }

    const haystack = [option.label, option.group, option.value, ...option.keywords]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedKeyword);
  });
});

const selectValue = (value: string) => {
  emit('update:modelValue', value);
  dialogVisible.value = false;
};

const clearValue = () => {
  emit('update:modelValue', null);
};
</script>

<style scoped lang="scss">
.uno-icon-picker {
  width: 100%;
}

.uno-icon-picker__trigger {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  background: var(--surface-card-soft-bg);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.uno-icon-picker__trigger:hover {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--line-strong));
  box-shadow: var(--shadow-panel);
  transform: translateY(-1px);
}

.uno-icon-picker__preview,
.uno-icon-picker__current-preview,
.uno-icon-picker__item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--accent-strong);
}

.uno-icon-picker__preview,
.uno-icon-picker__current-preview {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: var(--surface-accent-subtle);
}

.uno-icon-picker__copy,
.uno-icon-picker__current-copy,
.uno-icon-picker__item-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.uno-icon-picker__copy {
  flex: 1;
}

.uno-icon-picker__copy strong,
.uno-icon-picker__current-copy strong,
.uno-icon-picker__item-copy strong {
  color: var(--ink-1);
  font-size: 14px;
}

.uno-icon-picker__copy small,
.uno-icon-picker__current-copy span,
.uno-icon-picker__item-copy small {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.uno-icon-picker__action {
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 700;
}

.uno-icon-picker__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 12px;
  margin-bottom: 14px;
}

.uno-icon-picker__current {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: var(--surface-card-bg);
}

.uno-icon-picker__current-copy {
  flex: 1;
}

.uno-icon-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  padding: 2px 2px 6px;
}

.uno-icon-picker__item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: var(--surface-card-bg);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.uno-icon-picker__item:hover,
.uno-icon-picker__item.is-active {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--line-strong));
  box-shadow: var(--shadow-panel);
  transform: translateY(-1px);
}

.uno-icon-picker__item.is-active {
  background: var(--surface-accent-soft);
}

@media (max-width: 720px) {
  .uno-icon-picker__toolbar {
    grid-template-columns: 1fr;
  }

  .uno-icon-picker__current {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
