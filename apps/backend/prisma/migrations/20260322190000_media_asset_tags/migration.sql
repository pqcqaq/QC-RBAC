ALTER TABLE "MediaAsset"
  ADD COLUMN "tag1" TEXT,
  ADD COLUMN "tag2" TEXT;

CREATE INDEX "MediaAsset_tag1_idx" ON "MediaAsset"("tag1");
CREATE INDEX "MediaAsset_tag2_idx" ON "MediaAsset"("tag2");
