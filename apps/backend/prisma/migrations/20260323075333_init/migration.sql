-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthIdentifierType" AS ENUM ('USERNAME', 'EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "AuthCredentialType" AS ENUM ('PASSWORD', 'VERIFICATION_CODE');

-- CreateEnum
CREATE TYPE "AuthVerificationPurpose" AS ENUM ('LOGIN', 'REGISTER');

-- CreateEnum
CREATE TYPE "AuthClientType" AS ENUM ('WEB', 'UNI_WECHAT_MINIAPP', 'APP');

-- CreateEnum
CREATE TYPE "OAuthProviderProtocol" AS ENUM ('OIDC', 'OAUTH2');

-- CreateEnum
CREATE TYPE "OAuthProviderClientAuthMethod" AS ENUM ('CLIENT_SECRET_BASIC', 'CLIENT_SECRET_POST');

-- CreateEnum
CREATE TYPE "OAuthApplicationClientType" AS ENUM ('PUBLIC', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "OAuthStateKind" AS ENUM ('EXTERNAL_LOGIN', 'AUTHORIZE_SESSION', 'LOGIN_TICKET');

-- CreateEnum
CREATE TYPE "OAuthTokenKind" AS ENUM ('AUTHORIZATION_CODE', 'ACCESS_TOKEN', 'REFRESH_TOKEN', 'EXTERNAL_ACCESS_TOKEN', 'EXTERNAL_REFRESH_TOKEN');

-- CreateEnum
CREATE TYPE "OAuthCodeChallengeMethod" AS ENUM ('S256', 'PLAIN');

-- CreateEnum
CREATE TYPE "MediaAssetStorageProvider" AS ENUM ('LOCAL', 'S3');

-- CreateEnum
CREATE TYPE "MediaAssetUploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MediaAssetUploadStrategy" AS ENUM ('SINGLE', 'CHUNKED');

-- CreateEnum
CREATE TYPE "MenuNodeType" AS ENUM ('DIRECTORY', 'PAGE', 'ACTION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "nickname" TEXT NOT NULL,
    "avatarFileId" TEXT,
    "preferences" JSONB,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthClient" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AuthClientType" NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "secretHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "AuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthStrategy" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "identifierType" "AuthIdentifierType" NOT NULL,
    "credentialType" "AuthCredentialType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "loginEnabled" BOOLEAN NOT NULL DEFAULT true,
    "registerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "verificationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mockEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mockValue" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "AuthStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAuthentication" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "credentialHash" TEXT,
    "salt" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "UserAuthentication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "strategyId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "purpose" "AuthVerificationPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuNode" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "code" TEXT NOT NULL,
    "type" "MenuNodeType" NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "path" TEXT,
    "viewKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "permissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "MenuNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "tag1" TEXT,
    "tag2" TEXT,
    "storageProvider" "MediaAssetStorageProvider" NOT NULL DEFAULT 'LOCAL',
    "storageBucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "uploadToken" TEXT NOT NULL,
    "uploadStatus" "MediaAssetUploadStatus" NOT NULL DEFAULT 'PENDING',
    "uploadStrategy" "MediaAssetUploadStrategy" NOT NULL DEFAULT 'SINGLE',
    "chunkSize" INTEGER,
    "chunkCount" INTEGER,
    "etag" TEXT,
    "url" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthProvider" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "protocol" "OAuthProviderProtocol" NOT NULL DEFAULT 'OIDC',
    "issuer" TEXT,
    "discoveryUrl" TEXT,
    "authorizationEndpoint" TEXT NOT NULL,
    "tokenEndpoint" TEXT NOT NULL,
    "userinfoEndpoint" TEXT,
    "jwksUri" TEXT,
    "clientId" TEXT NOT NULL,
    "clientSecretEncrypted" TEXT,
    "defaultScopes" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowLogin" BOOLEAN NOT NULL DEFAULT true,
    "autoRegister" BOOLEAN NOT NULL DEFAULT true,
    "autoLinkByEmail" BOOLEAN NOT NULL DEFAULT true,
    "usePkce" BOOLEAN NOT NULL DEFAULT true,
    "clientAuthMethod" "OAuthProviderClientAuthMethod" NOT NULL DEFAULT 'CLIENT_SECRET_BASIC',
    "claimMapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "OAuthProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthApplication" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "homepageUrl" TEXT,
    "clientId" TEXT NOT NULL,
    "clientType" "OAuthApplicationClientType" NOT NULL,
    "clientSecretHash" TEXT,
    "salt" TEXT,
    "redirectUris" TEXT[],
    "postLogoutRedirectUris" TEXT[],
    "defaultScopes" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "skipConsent" BOOLEAN NOT NULL DEFAULT false,
    "requirePkce" BOOLEAN NOT NULL DEFAULT true,
    "allowAuthorizationCode" BOOLEAN NOT NULL DEFAULT true,
    "allowRefreshToken" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "OAuthApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthApplicationPermission" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "applicationId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "OAuthApplicationPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "kind" "OAuthStateKind" NOT NULL,
    "state" TEXT NOT NULL,
    "providerId" TEXT,
    "applicationId" TEXT,
    "userId" TEXT,
    "authClientId" TEXT,
    "redirectUri" TEXT,
    "nonce" TEXT,
    "codeVerifier" TEXT,
    "payload" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthUser" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "nickname" TEXT,
    "avatarUrl" TEXT,
    "rawProfile" JSONB,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "OAuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "kind" "OAuthTokenKind" NOT NULL,
    "tokenId" TEXT NOT NULL,
    "tokenHash" TEXT,
    "encryptedValue" TEXT,
    "applicationId" TEXT,
    "providerId" TEXT,
    "oauthUserId" TEXT,
    "userId" TEXT,
    "sessionId" TEXT,
    "redirectUri" TEXT,
    "scope" TEXT[],
    "audience" TEXT[],
    "codeChallenge" TEXT,
    "codeChallengeMethod" "OAuthCodeChallengeMethod",
    "nonce" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deleteAt_idx" ON "User"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthClient_code_key" ON "AuthClient"("code");

-- CreateIndex
CREATE INDEX "AuthClient_deleteAt_idx" ON "AuthClient"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthStrategy_code_key" ON "AuthStrategy"("code");

-- CreateIndex
CREATE INDEX "AuthStrategy_deleteAt_idx" ON "AuthStrategy"("deleteAt");

-- CreateIndex
CREATE INDEX "UserAuthentication_userId_idx" ON "UserAuthentication"("userId");

-- CreateIndex
CREATE INDEX "UserAuthentication_deleteAt_idx" ON "UserAuthentication"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAuthentication_strategyId_identifier_key" ON "UserAuthentication"("strategyId", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "UserAuthentication_userId_strategyId_key" ON "UserAuthentication"("userId", "strategyId");

-- CreateIndex
CREATE INDEX "VerificationCode_strategyId_identifier_purpose_idx" ON "VerificationCode"("strategyId", "identifier", "purpose");

-- CreateIndex
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");

-- CreateIndex
CREATE INDEX "VerificationCode_deleteAt_idx" ON "VerificationCode"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "Role_deleteAt_idx" ON "Role"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Permission_deleteAt_idx" ON "Permission"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "MenuNode_code_key" ON "MenuNode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MenuNode_path_key" ON "MenuNode"("path");

-- CreateIndex
CREATE UNIQUE INDEX "MenuNode_viewKey_key" ON "MenuNode"("viewKey");

-- CreateIndex
CREATE UNIQUE INDEX "MenuNode_permissionId_key" ON "MenuNode"("permissionId");

-- CreateIndex
CREATE INDEX "MenuNode_parentId_sortOrder_idx" ON "MenuNode"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuNode_type_idx" ON "MenuNode"("type");

-- CreateIndex
CREATE INDEX "MenuNode_deleteAt_idx" ON "MenuNode"("deleteAt");

-- CreateIndex
CREATE INDEX "UserRole_userId_deleteAt_idx" ON "UserRole"("userId", "deleteAt");

-- CreateIndex
CREATE INDEX "UserRole_roleId_deleteAt_idx" ON "UserRole"("roleId", "deleteAt");

-- CreateIndex
CREATE INDEX "UserRole_deleteAt_idx" ON "UserRole"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_deleteAt_idx" ON "RolePermission"("roleId", "deleteAt");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_deleteAt_idx" ON "RolePermission"("permissionId", "deleteAt");

-- CreateIndex
CREATE INDEX "RolePermission_deleteAt_idx" ON "RolePermission"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_clientId_idx" ON "RefreshToken"("userId", "clientId");

-- CreateIndex
CREATE INDEX "RefreshToken_deleteAt_idx" ON "RefreshToken"("deleteAt");

-- CreateIndex
CREATE INDEX "ActivityLog_deleteAt_idx" ON "ActivityLog"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_uploadToken_key" ON "MediaAsset"("uploadToken");

-- CreateIndex
CREATE INDEX "MediaAsset_userId_kind_idx" ON "MediaAsset"("userId", "kind");

-- CreateIndex
CREATE INDEX "MediaAsset_tag1_idx" ON "MediaAsset"("tag1");

-- CreateIndex
CREATE INDEX "MediaAsset_tag2_idx" ON "MediaAsset"("tag2");

-- CreateIndex
CREATE INDEX "MediaAsset_uploadStatus_idx" ON "MediaAsset"("uploadStatus");

-- CreateIndex
CREATE INDEX "MediaAsset_deleteAt_idx" ON "MediaAsset"("deleteAt");

-- CreateIndex
CREATE INDEX "ChatMessage_deleteAt_idx" ON "ChatMessage"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthProvider_code_key" ON "OAuthProvider"("code");

-- CreateIndex
CREATE INDEX "OAuthProvider_enabled_allowLogin_idx" ON "OAuthProvider"("enabled", "allowLogin");

-- CreateIndex
CREATE INDEX "OAuthProvider_deleteAt_idx" ON "OAuthProvider"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplication_code_key" ON "OAuthApplication"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplication_clientId_key" ON "OAuthApplication"("clientId");

-- CreateIndex
CREATE INDEX "OAuthApplication_enabled_idx" ON "OAuthApplication"("enabled");

-- CreateIndex
CREATE INDEX "OAuthApplication_deleteAt_idx" ON "OAuthApplication"("deleteAt");

-- CreateIndex
CREATE INDEX "OAuthApplicationPermission_applicationId_deleteAt_idx" ON "OAuthApplicationPermission"("applicationId", "deleteAt");

-- CreateIndex
CREATE INDEX "OAuthApplicationPermission_permissionId_deleteAt_idx" ON "OAuthApplicationPermission"("permissionId", "deleteAt");

-- CreateIndex
CREATE INDEX "OAuthApplicationPermission_deleteAt_idx" ON "OAuthApplicationPermission"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplicationPermission_applicationId_permissionId_key" ON "OAuthApplicationPermission"("applicationId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_state_key" ON "OAuthState"("state");

-- CreateIndex
CREATE INDEX "OAuthState_kind_expiresAt_idx" ON "OAuthState"("kind", "expiresAt");

-- CreateIndex
CREATE INDEX "OAuthState_providerId_idx" ON "OAuthState"("providerId");

-- CreateIndex
CREATE INDEX "OAuthState_applicationId_idx" ON "OAuthState"("applicationId");

-- CreateIndex
CREATE INDEX "OAuthState_userId_idx" ON "OAuthState"("userId");

-- CreateIndex
CREATE INDEX "OAuthState_authClientId_idx" ON "OAuthState"("authClientId");

-- CreateIndex
CREATE INDEX "OAuthState_deleteAt_idx" ON "OAuthState"("deleteAt");

-- CreateIndex
CREATE INDEX "OAuthUser_userId_idx" ON "OAuthUser"("userId");

-- CreateIndex
CREATE INDEX "OAuthUser_providerId_idx" ON "OAuthUser"("providerId");

-- CreateIndex
CREATE INDEX "OAuthUser_deleteAt_idx" ON "OAuthUser"("deleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthUser_providerId_providerSubject_key" ON "OAuthUser"("providerId", "providerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthUser_userId_providerId_key" ON "OAuthUser"("userId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_tokenId_key" ON "OAuthToken"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_tokenHash_key" ON "OAuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OAuthToken_kind_expiresAt_idx" ON "OAuthToken"("kind", "expiresAt");

-- CreateIndex
CREATE INDEX "OAuthToken_applicationId_kind_idx" ON "OAuthToken"("applicationId", "kind");

-- CreateIndex
CREATE INDEX "OAuthToken_providerId_kind_idx" ON "OAuthToken"("providerId", "kind");

-- CreateIndex
CREATE INDEX "OAuthToken_oauthUserId_kind_idx" ON "OAuthToken"("oauthUserId", "kind");

-- CreateIndex
CREATE INDEX "OAuthToken_userId_kind_idx" ON "OAuthToken"("userId", "kind");

-- CreateIndex
CREATE INDEX "OAuthToken_sessionId_idx" ON "OAuthToken"("sessionId");

-- CreateIndex
CREATE INDEX "OAuthToken_refreshAt_idx" ON "OAuthToken"("refreshAt");

-- CreateIndex
CREATE INDEX "OAuthToken_deleteAt_idx" ON "OAuthToken"("deleteAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarFileId_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAuthentication" ADD CONSTRAINT "UserAuthentication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAuthentication" ADD CONSTRAINT "UserAuthentication_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "AuthStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "AuthStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuNode" ADD CONSTRAINT "MenuNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MenuNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuNode" ADD CONSTRAINT "MenuNode_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApplicationPermission" ADD CONSTRAINT "OAuthApplicationPermission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OAuthApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApplicationPermission" ADD CONSTRAINT "OAuthApplicationPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "OAuthProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OAuthApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_authClientId_fkey" FOREIGN KEY ("authClientId") REFERENCES "AuthClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthUser" ADD CONSTRAINT "OAuthUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthUser" ADD CONSTRAINT "OAuthUser_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "OAuthProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OAuthApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "OAuthProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_oauthUserId_fkey" FOREIGN KEY ("oauthUserId") REFERENCES "OAuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
