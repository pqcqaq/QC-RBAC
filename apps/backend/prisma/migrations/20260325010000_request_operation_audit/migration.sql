-- CreateEnum
CREATE TYPE "RequestAuthMode" AS ENUM ('LOCAL', 'OAUTH', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "OperationAccessKind" AS ENUM ('MANAGED', 'RAW');

-- CreateEnum
CREATE TYPE "OperationEffectKind" AS ENUM ('READ', 'WRITE');

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_actorId_fkey";

-- DropTable
DROP TABLE "ActivityLog";

-- CreateTable
CREATE TABLE "RequestRecord" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "authMode" "RequestAuthMode" NOT NULL DEFAULT 'ANONYMOUS',
    "authClientId" TEXT,
    "authClientCode" TEXT,
    "authClientType" "AuthClientType",
    "oauthApplicationId" TEXT,
    "oauthApplicationCode" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestQuery" JSONB,
    "requestParams" JSONB,
    "requestBody" JSONB,
    "statusCode" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorDetail" JSONB,
    "operationCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "writeCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "requestRecordId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "effectiveOperation" TEXT,
    "accessKind" "OperationAccessKind" NOT NULL,
    "effectKind" "OperationEffectKind" NOT NULL,
    "committed" BOOLEAN NOT NULL DEFAULT true,
    "softDelete" BOOLEAN NOT NULL DEFAULT false,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "primaryEntityId" TEXT,
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "affectedIds" TEXT[],
    "query" JSONB,
    "mutation" JSONB,
    "result" JSONB,
    "effect" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestRecord_startedAt_idx" ON "RequestRecord"("startedAt");

-- CreateIndex
CREATE INDEX "RequestRecord_actorId_startedAt_idx" ON "RequestRecord"("actorId", "startedAt");

-- CreateIndex
CREATE INDEX "RequestRecord_method_startedAt_idx" ON "RequestRecord"("method", "startedAt");

-- CreateIndex
CREATE INDEX "RequestRecord_statusCode_startedAt_idx" ON "RequestRecord"("statusCode", "startedAt");

-- CreateIndex
CREATE INDEX "RequestRecord_success_startedAt_idx" ON "RequestRecord"("success", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_requestRecordId_sequence_key" ON "Operation"("requestRecordId", "sequence");

-- CreateIndex
CREATE INDEX "Operation_requestRecordId_startedAt_idx" ON "Operation"("requestRecordId", "startedAt");

-- CreateIndex
CREATE INDEX "Operation_model_operation_startedAt_idx" ON "Operation"("model", "operation", "startedAt");

-- CreateIndex
CREATE INDEX "Operation_primaryEntityId_idx" ON "Operation"("primaryEntityId");

-- CreateIndex
CREATE INDEX "Operation_effectKind_startedAt_idx" ON "Operation"("effectKind", "startedAt");

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_requestRecordId_fkey" FOREIGN KEY ("requestRecordId") REFERENCES "RequestRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
