<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="920px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="oauth-editor-scroll">
      <el-form label-position="top" class="page-form-grid">
        <el-form-item label="应用编码">
          <el-input v-model="form.code" />
        </el-form-item>

        <el-form-item label="应用名称">
          <el-input v-model="form.name" />
        </el-form-item>

        <el-form-item label="客户端类型">
          <el-select v-model="form.clientType">
            <el-option label="Confidential" value="CONFIDENTIAL" />
            <el-option label="Public" value="PUBLIC" />
          </el-select>
        </el-form-item>

        <el-form-item label="状态">
          <el-switch v-model="form.enabled" inline-prompt active-text="启用" inactive-text="禁用" />
        </el-form-item>

        <el-form-item label="描述" class="page-form-grid__full">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="240"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="Logo URL" class="page-form-grid__full">
          <el-input v-model="form.logoUrl" placeholder="https://example.com/logo.png" />
        </el-form-item>

        <el-form-item label="Homepage URL" class="page-form-grid__full">
          <el-input v-model="form.homepageUrl" placeholder="https://app.example.com" />
        </el-form-item>

        <el-form-item label="Client ID">
          <el-input v-model="form.clientId" />
        </el-form-item>

        <el-form-item label="Client Secret">
          <el-input
            v-model="form.clientSecret"
            show-password
            :placeholder="
              form.clientType === 'PUBLIC'
                ? 'Public 应用无需配置 client secret'
                : isEditing
                  ? '留空表示保持当前密钥'
                  : '请输入客户端密钥'
            "
            :disabled="form.clientType === 'PUBLIC'"
          />
        </el-form-item>

        <el-form-item label="Redirect URIs" class="page-form-grid__full">
          <el-input
            v-model="form.redirectUrisText"
            type="textarea"
            :rows="4"
            placeholder="每行一个 redirect uri"
          />
        </el-form-item>

        <el-form-item label="Post Logout Redirect URIs" class="page-form-grid__full">
          <el-input
            v-model="form.postLogoutRedirectUrisText"
            type="textarea"
            :rows="3"
            placeholder="每行一个 post logout redirect uri"
          />
        </el-form-item>

        <el-form-item label="默认 Scopes" class="page-form-grid__full">
          <el-input
            v-model="form.defaultScopesText"
            type="textarea"
            :rows="4"
            placeholder="每行一个 scope，或用逗号分隔"
          />
        </el-form-item>

        <RelationSelectFormItem
          v-model="form.permissionIds"
          class="page-form-grid__full"
          label="权限 Scopes"
          dialog-title="选择权限 Scope"
          trigger-text="选择权限 Scope"
          :request="loadPermissionOptions"
          :search-defaults="{ q: '' }"
          multiple
        >
          <template #search="{ params, search, reset }">
            <div class="relation-search-bar">
              <el-input
                v-model="params.q"
                clearable
                placeholder="搜索权限名称、编码或模块"
                @keyup.enter="search"
              />
              <el-button @click="search">搜索</el-button>
              <el-button @click="reset">重置</el-button>
            </div>
          </template>

          <template #row="{ row }">
            <div class="relation-option-list">
              <strong>{{ row.name }}</strong>
              <span>{{ row.code }}</span>
              <p>{{ row.module }} · {{ row.action }}</p>
            </div>
          </template>
        </RelationSelectFormItem>

        <el-divider class="page-form-grid__full" content-position="left">授权策略</el-divider>

        <el-form-item label="跳过 Consent">
          <el-switch
            v-model="form.skipConsent"
            inline-prompt
            active-text="开启"
            inactive-text="关闭"
          />
        </el-form-item>

        <el-form-item label="要求 PKCE">
          <el-switch
            v-model="form.requirePkce"
            inline-prompt
            active-text="开启"
            inactive-text="关闭"
          />
        </el-form-item>

        <el-form-item label="启用授权码">
          <el-switch
            v-model="form.allowAuthorizationCode"
            inline-prompt
            active-text="开启"
            inactive-text="关闭"
          />
        </el-form-item>

        <el-form-item label="启用刷新令牌">
          <el-switch
            v-model="form.allowRefreshToken"
            inline-prompt
            active-text="开启"
            inactive-text="关闭"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="emit('save')">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { api } from '@/api/client';
import RelationSelectFormItem from '@/components/form/RelationSelectFormItem.vue';
import type { OAuthApplicationEditorForm } from '../application-management';

const loadPermissionOptions = api.oauth.applications.permissions;

defineProps<{
  visible: boolean;
  title: string;
  isEditing: boolean;
  form: OAuthApplicationEditorForm;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save: [];
}>();
</script>

<style scoped lang="scss">
.oauth-editor-scroll {
  max-height: 68vh;
  overflow: auto;
  padding-right: 4px;
}

.relation-search-bar {
  display: flex;
  gap: 10px;
}

.relation-search-bar :deep(.el-input) {
  flex: 1;
}

.relation-option-list {
  display: grid;
  gap: 4px;
}

.relation-option-list strong {
  font-size: 14px;
  line-height: 1.4;
}

.relation-option-list span,
.relation-option-list p {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.5;
}
</style>
