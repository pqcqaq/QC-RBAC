<script setup lang="ts">
import { computed, ref, watch } from 'vue'

defineOptions({
  name: 'AppInput',
})

type AppInputType = 'text' | 'number' | 'digit' | 'idcard' | 'nickname'
type AppInputConfirmType = 'send' | 'search' | 'next' | 'go' | 'done'

interface UniInputEventDetail {
  value?: string
}

interface UniInputEvent {
  detail: UniInputEventDetail
}

const props = withDefaults(defineProps<{
  modelValue?: string
  label?: string
  placeholder?: string
  clearable?: boolean
  showPassword?: boolean
  type?: AppInputType
  confirmType?: AppInputConfirmType
  disabled?: boolean
}>(), {
  modelValue: '',
  label: '',
  placeholder: '',
  clearable: false,
  showPassword: false,
  type: 'text',
  confirmType: 'done',
  disabled: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'confirm'): void
}>()

const passwordVisible = ref(false)

const hasValue = computed(() => Boolean(props.modelValue))
const inputType = computed<AppInputType>(() => props.showPassword ? 'text' : props.type)
const usePassword = computed(() => props.showPassword && !passwordVisible.value)
const passwordToggleText = computed(() => passwordVisible.value ? '隐藏' : '显示')

watch(() => props.showPassword, (enabled) => {
  if (!enabled) {
    passwordVisible.value = false
  }
})

function handleInput(event: UniInputEvent) {
  emit('update:modelValue', event.detail.value ?? '')
}

function handleConfirm() {
  emit('confirm')
}

function clearValue() {
  if (props.disabled) {
    return
  }
  emit('update:modelValue', '')
}

function togglePasswordVisible() {
  if (props.disabled) {
    return
  }
  passwordVisible.value = !passwordVisible.value
}
</script>

<template>
  <view class="app-input">
    <view v-if="label" class="app-input__label">
      <text>{{ label }}</text>
    </view>

    <view class="app-input__control">
      <input
        class="app-input__inner"
        :value="modelValue"
        :type="inputType"
        :password="usePassword"
        :placeholder="placeholder"
        placeholder-style="color: #9aa3ad;"
        :confirm-type="confirmType"
        :disabled="disabled"
        :cursor-spacing="24"
        @input="handleInput"
        @confirm="handleConfirm"
      >

      <view v-if="(clearable && hasValue) || showPassword" class="app-input__actions">
        <text
          v-if="clearable && hasValue"
          class="app-input__action-text"
          @click.stop="clearValue"
        >
          清除
        </text>
        <text
          v-if="showPassword"
          class="app-input__action-text"
          @click.stop="togglePasswordVisible"
        >
          {{ passwordToggleText }}
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-input {
  display: flex;
  align-items: center;
  min-height: 96rpx;
  padding: 0 24rpx;
  background: transparent;
  box-sizing: border-box;
}

.app-input__label {
  width: 120rpx;
  padding-right: 16rpx;
  font-size: 26rpx;
  line-height: 1.4;
  color: var(--app-text-secondary);
  flex-shrink: 0;
}

.app-input__control {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.app-input__inner {
  flex: 1;
  min-width: 0;
  height: 96rpx;
  font-size: 30rpx;
  line-height: 96rpx;
  color: var(--app-text);
  background: transparent;
}

.app-input__actions {
  display: flex;
  align-items: center;
  margin-left: 16rpx;
  flex-shrink: 0;
}

.app-input__action-text {
  font-size: 24rpx;
  line-height: 1.4;
  color: var(--app-text-muted);
}

.app-input__action-text + .app-input__action-text {
  margin-left: 20rpx;
}
</style>
