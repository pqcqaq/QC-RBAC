<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="900px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="oauth-editor-scroll">
      <el-form label-position="top" class="page-form-grid">
        <el-form-item label="供应商编码">
          <el-input v-model="form.code" />
        </el-form-item>

        <el-form-item label="供应商名称">
          <el-input v-model="form.name" />
        </el-form-item>

        <el-form-item label="协议">
          <el-select v-model="form.protocol">
            <el-option label="OIDC" value="OIDC" />
            <el-option label="OAuth 2.0" value="OAUTH2" />
          </el-select>
        </el-form-item>

        <el-form-item label="Client Auth Method">
          <el-select v-model="form.clientAuthMethod">
            <el-option label="Client Secret Basic" value="CLIENT_SECRET_BASIC" />
            <el-option label="Client Secret Post" value="CLIENT_SECRET_POST" />
          </el-select>
        </el-form-item>

        <el-form-item label="描述" class="page-form-grid__full">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="240" show-word-limit />
        </el-form-item>

        <el-form-item label="Logo URL" class="page-form-grid__full">
          <el-input v-model="form.logoUrl" placeholder="https://example.com/logo.png" />
        </el-form-item>

        <el-form-item label="Client ID">
          <el-input v-model="form.clientId" />
        </el-form-item>

        <el-form-item label="Client Secret">
          <el-input
            v-model="form.clientSecret"
            show-password
            :placeholder="isEditing ? '留空表示保持当前密钥' : '请输入客户端密钥'"
          />
        </el-form-item>

        <el-form-item label="Discovery URL">
          <el-input v-model="form.discoveryUrl" placeholder="https://issuer/.well-known/openid-configuration" />
        </el-form-item>

        <el-form-item label="Issuer">
          <el-input v-model="form.issuer" placeholder="https://issuer.example.com" />
        </el-form-item>

        <el-form-item label="Authorization Endpoint" class="page-form-grid__full">
          <el-input v-model="form.authorizationEndpoint" placeholder="https://issuer.example.com/oauth2/authorize" />
        </el-form-item>

        <el-form-item label="Token Endpoint" class="page-form-grid__full">
          <el-input v-model="form.tokenEndpoint" placeholder="https://issuer.example.com/oauth2/token" />
        </el-form-item>

        <el-form-item label="Userinfo Endpoint" class="page-form-grid__full">
          <el-input v-model="form.userinfoEndpoint" placeholder="https://issuer.example.com/oauth2/userinfo" />
        </el-form-item>

        <el-form-item label="JWKS URI" class="page-form-grid__full">
          <el-input v-model="form.jwksUri" placeholder="https://issuer.example.com/oauth2/jwks" />
        </el-form-item>

        <el-form-item label="默认 Scopes" class="page-form-grid__full">
          <el-input
            v-model="form.defaultScopesText"
            type="textarea"
            :rows="4"
            placeholder="每行一个 scope，或用逗号分隔"
          />
        </el-form-item>

        <el-divider class="page-form-grid__full" content-position="left">行为控制</el-divider>

        <el-form-item label="启用">
          <el-switch v-model="form.enabled" inline-prompt active-text="启用" inactive-text="禁用" />
        </el-form-item>

        <el-form-item label="允许登录">
          <el-switch v-model="form.allowLogin" inline-prompt active-text="允许" inactive-text="关闭" />
        </el-form-item>

        <el-form-item label="自动注册">
          <el-switch v-model="form.autoRegister" inline-prompt active-text="开启" inactive-text="关闭" />
        </el-form-item>

        <el-form-item label="邮箱自动关联">
          <el-switch v-model="form.autoLinkByEmail" inline-prompt active-text="开启" inactive-text="关闭" />
        </el-form-item>

        <el-form-item label="使用 PKCE">
          <el-switch v-model="form.usePkce" inline-prompt active-text="开启" inactive-text="关闭" />
        </el-form-item>

        <el-divider class="page-form-grid__full" content-position="left">Claim Mapping</el-divider>

        <el-form-item label="Subject Claim">
          <el-input v-model="form.claimMapping.subject" />
        </el-form-item>

        <el-form-item label="Email Claim">
          <el-input v-model="form.claimMapping.email" />
        </el-form-item>

        <el-form-item label="Username Claim">
          <el-input v-model="form.claimMapping.username" />
        </el-form-item>

        <el-form-item label="Nickname Claim">
          <el-input v-model="form.claimMapping.nickname" />
        </el-form-item>

        <el-form-item label="Avatar Claim" class="page-form-grid__full">
          <el-input v-model="form.claimMapping.avatarUrl" />
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
import type { OAuthProviderEditorForm } from '../provider-management';

defineProps<{
  visible: boolean;
  title: string;
  isEditing: boolean;
  form: OAuthProviderEditorForm;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save: [];
}>();
</script>

<style scoped>
.oauth-editor-scroll {
  max-height: 68vh;
  overflow: auto;
  padding-right: 4px;
}
</style>
