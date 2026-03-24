-- CreateTable
CREATE TABLE "RealtimeTopic" (
    "id" TEXT NOT NULL,
    "createId" TEXT,
    "updateId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "topicPattern" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" TIMESTAMP(3),

    CONSTRAINT "RealtimeTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RealtimeTopic_code_key" ON "RealtimeTopic"("code");

-- CreateIndex
CREATE INDEX "RealtimeTopic_topicPattern_idx" ON "RealtimeTopic"("topicPattern");

-- CreateIndex
CREATE INDEX "RealtimeTopic_permissionId_deleteAt_idx" ON "RealtimeTopic"("permissionId", "deleteAt");

-- CreateIndex
CREATE INDEX "RealtimeTopic_deleteAt_idx" ON "RealtimeTopic"("deleteAt");

-- AddForeignKey
ALTER TABLE "RealtimeTopic" ADD CONSTRAINT "RealtimeTopic_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
