<script lang="ts" setup>
import type {
  AppDensityMode,
  AppPortalLayout,
  AppSurfaceStyle,
  AppTabbarStyle,
  AppThemeMode,
  AppThemePresetId,
  UserAppPreferences,
} from '@rbac/api-common'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import { defaultAppPreferences, useUiStore } from '@/store/ui'
import { useUserStore } from '@/store/user'
import { useTokenStore } from '@/store/token'
import { getErrorMessage } from '@/utils/error'

definePage({
  style: {
    navigationBarTitleText: '应用设置',
  },
})

const uiStore = useUiStore()
const userStore = useUserStore()
const tokenStore = useTokenStore()
const { userInfo } = storeToRefs(userStore)

const saving = ref(false)
const draft = reactive<UserAppPreferences>({
  ...defaultAppPreferences,
})

const themeModeOptions = [
  { label: '跟随系统', value: 'auto', description: '根据系统深浅色切换' },
  { label: '浅色', value: 'light', description: '适合明亮环境' },
  { label: '深色', value: 'dark', description: '降低夜间视觉刺激' },
]

const themePresetOptions = [
  { label: '石墨', value: 'graphite', description: '低饱和中性色' },
  { label: '海洋', value: 'ocean', description: '蓝青色强调' },
  { label: '森林', value: 'forest', description: '绿色强调' },
  { label: '落日', value: 'sunset', description: '橙暖色强调' },
]

const surfaceOptions = [
  { label: '柔和', value: 'soft', description: '轻微层次和阴影' },
  { label: '实体', value: 'solid', description: '更实心的卡片背景' },
  { label: '玻璃', value: 'glass', description: '半透明表面风格' },
]

const densityOptions = [
  { label: '舒适', value: 'comfortable', description: '默认间距和字号' },
  { label: '紧凑', value: 'compact', description: '提高信息密度' },
]

const tabbarOptions = [
  { label: '悬浮', value: 'floating', description: '圆角悬浮底栏' },
  { label: '贴边', value: 'solid', description: '紧贴底部边界' },
]

const portalLayoutOptions = [
  { label: '概览模式', value: 'overview', description: '展示完整模块卡片' },
  { label: '聚焦模式', value: 'focus', description: '聚焦关键数据和入口' },
]

const hasChanges = computed(() => {
  return (
    draft.themeMode !== uiStore.preferences.themeMode
    || draft.themePresetId !== uiStore.preferences.themePresetId
    || draft.surfaceStyle !== uiStore.preferences.surfaceStyle
    || draft.density !== uiStore.preferences.density
    || draft.tabbarStyle !== uiStore.preferences.tabbarStyle
    || draft.portalLayout !== uiStore.preferences.portalLayout
    || draft.motionEnabled !== uiStore.preferences.motionEnabled
  )
})

const previewSummary = computed(() => {
  const motionText = draft.motionEnabled ? '开' : '关'
  return `${draft.themePresetId} · ${draft.themeMode} · ${draft.density} · 动效 ${motionText}`
})

function hydrateDraft() {
  const source = userInfo.value.preferences?.app || uiStore.preferences
  Object.assign(draft, {
    ...defaultAppPreferences,
    ...source,
  })
  uiStore.hydrateFromUserPreferences(source)
}

function handleMotionToggle(event: { detail?: { value?: boolean } }) {
  draft.motionEnabled = Boolean(event?.detail?.value)
}

function resetToDefault() {
  Object.assign(draft, defaultAppPreferences)
}

async function savePreferences() {
  if (!tokenStore.hasLogin || saving.value) {
    return
  }

  saving.value = true
  try {
    uiStore.patchPreferences({ ...draft })
    const payload = await uiStore.persistPreferences()
    userStore.setAppPreferences(payload)
    uni.showToast({
      title: '设置已同步',
      icon: 'none',
    })
  }
  catch (error: unknown) {
    hydrateDraft()
    uni.showToast({
      title: getErrorMessage(error, '设置保存失败'),
      icon: 'none',
    })
  }
  finally {
    saving.value = false
  }
}

function onThemeModeChange(value: string) {
  draft.themeMode = value as AppThemeMode
}

function onThemePresetChange(value: string) {
  draft.themePresetId = value as AppThemePresetId
}

function onSurfaceChange(value: string) {
  draft.surfaceStyle = value as AppSurfaceStyle
}

function onDensityChange(value: string) {
  draft.density = value as AppDensityMode
}

function onTabbarChange(value: string) {
  draft.tabbarStyle = value as AppTabbarStyle
}

function onPortalLayoutChange(value: string) {
  draft.portalLayout = value as AppPortalLayout
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }

  void userStore.fetchUserInfo()
    .then(() => {
      hydrateDraft()
    })
    .catch(() => {
      hydrateDraft()
    })
})
</script>

<template>
  <AppPageShell title="应用设置" description="配置主题、布局与交互密度，保存后会同步到账号。">
    <AppSection title="即时预览" :description="previewSummary">
      <view class="settings-preview">
        <view class="settings-preview__chip">
          portal: {{ draft.portalLayout }}
        </view>
        <view class="settings-preview__chip">
          tabbar: {{ draft.tabbarStyle }}
        </view>
      </view>
    </AppSection>

    <AppSection title="主题模式">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.themeMode"
          :options="themeModeOptions"
          @update:model-value="onThemeModeChange"
        />
      </view>
    </AppSection>

    <AppSection title="主题方案">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.themePresetId"
          :options="themePresetOptions"
          @update:model-value="onThemePresetChange"
        />
      </view>
    </AppSection>

    <AppSection title="界面风格">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.surfaceStyle"
          :options="surfaceOptions"
          @update:model-value="onSurfaceChange"
        />
      </view>
    </AppSection>

    <AppSection title="信息密度">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.density"
          :options="densityOptions"
          @update:model-value="onDensityChange"
        />
      </view>
    </AppSection>

    <AppSection title="底部导航">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.tabbarStyle"
          :options="tabbarOptions"
          @update:model-value="onTabbarChange"
        />
      </view>
    </AppSection>

    <AppSection title="门户布局">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.portalLayout"
          :options="portalLayoutOptions"
          @update:model-value="onPortalLayoutChange"
        />
      </view>
    </AppSection>

    <AppSection title="动效">
      <view class="settings-toggle-row">
        <view class="settings-toggle-row__meta">
          <view class="settings-toggle-row__title">
            页面动效
          </view>
          <view class="settings-toggle-row__desc">
            关闭后将降低动画时长，适合性能敏感场景。
          </view>
        </view>
        <switch
          :checked="draft.motionEnabled"
          color="var(--app-accent)"
          @change="handleMotionToggle"
        />
      </view>
    </AppSection>

    <view class="settings-actions">
      <AppButton block size="large" type="info" @click="resetToDefault">
        恢复默认
      </AppButton>
      <AppButton block size="large" :loading="saving" :disabled="!hasChanges" @click="savePreferences">
        保存并同步
      </AppButton>
    </view>
  </AppPageShell>
</template>

<style scoped lang="scss">
.settings-preview {
  padding: 0 32rpx;
  display: flex;
  flex-wrap: wrap;
  margin-left: -12rpx;
  margin-bottom: -12rpx;
}

.settings-preview__chip {
  margin-left: 12rpx;
  margin-bottom: 12rpx;
  padding: 10rpx 16rpx;
  border-radius: 14rpx;
  background: var(--app-accent-soft);
  color: var(--app-text-secondary);
  font-size: 22rpx;
}

.settings-choice-wrap {
  padding: 0 22rpx;
}

.settings-toggle-row {
  margin: 0 24rpx;
  padding: 20rpx 24rpx;
  background: var(--app-surface);
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-toggle-row__meta {
  flex: 1;
  min-width: 0;
  padding-right: 20rpx;
}

.settings-toggle-row__title {
  font-size: 28rpx;
  line-height: 1.4;
  color: var(--app-text);
  font-weight: 600;
}

.settings-toggle-row__desc {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.settings-actions {
  padding: 0 32rpx 12rpx;
}

.settings-actions .app-button + .app-button {
  margin-top: 16rpx;
}
</style>
