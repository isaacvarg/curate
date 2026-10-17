-- CreateTable
CREATE TABLE "item" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "levelPosition" INTEGER NOT NULL,
    "parentId" TEXT,
    "parentLevelPosition" INTEGER,
    "name" TEXT NOT NULL,
    "sortKey" BIGSERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_pkey" PRIMARY KEY ("id"),
    -- Hand-written: a top-Level Item has no parent; any other Item has a parent
    -- at the Level directly above. Both parent columns are set or both null,
    -- so the composite parent foreign key is never skipped (MATCH SIMPLE).
    CONSTRAINT "item_structure_check" CHECK (
        ("parentId" IS NULL AND "parentLevelPosition" IS NULL AND "levelPosition" = 0)
        OR ("parentId" IS NOT NULL AND "parentLevelPosition" IS NOT NULL
            AND "parentLevelPosition" = "levelPosition" - 1)
    )
);

-- CreateIndex
CREATE INDEX "item_collectionId_parentId_sortKey_idx" ON "item"("collectionId", "parentId", "sortKey");

-- CreateIndex
CREATE INDEX "item_parentId_idx" ON "item"("parentId");

-- CreateIndex
CREATE INDEX "item_levelId_idx" ON "item"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "item_id_collectionId_levelPosition_key" ON "item"("id", "collectionId", "levelPosition");

-- CreateIndex
CREATE UNIQUE INDEX "level_id_collectionId_position_key" ON "level"("id", "collectionId", "position");

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_levelId_collectionId_levelPosition_fkey" FOREIGN KEY ("levelId", "collectionId", "levelPosition") REFERENCES "level"("id", "collectionId", "position") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_parentId_collectionId_parentLevelPosition_fkey" FOREIGN KEY ("parentId", "collectionId", "parentLevelPosition") REFERENCES "item"("id", "collectionId", "levelPosition") ON DELETE CASCADE ON UPDATE CASCADE;

