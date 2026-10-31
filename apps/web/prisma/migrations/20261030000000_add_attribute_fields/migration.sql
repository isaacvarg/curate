-- CreateEnum
CREATE TYPE "field_kind" AS ENUM ('attribute');

-- CreateTable
CREATE TABLE "field" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "kind" "field_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_value" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_value_pkey" PRIMARY KEY ("id"),
    -- Hand-written: clearing a value deletes its row, so a stored value is
    -- never JSON null.
    CONSTRAINT "attribute_value_not_null_check" CHECK (jsonb_typeof("value") <> 'null')
);

-- CreateIndex
CREATE INDEX "field_levelId_position_idx" ON "field"("levelId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "field_id_levelId_key" ON "field"("id", "levelId");

-- CreateIndex
CREATE INDEX "attribute_value_fieldId_idx" ON "attribute_value"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_value_itemId_fieldId_key" ON "attribute_value"("itemId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "item_id_levelId_key" ON "item"("id", "levelId");

-- AddForeignKey
ALTER TABLE "field" ADD CONSTRAINT "field_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_value" ADD CONSTRAINT "attribute_value_itemId_levelId_fkey" FOREIGN KEY ("itemId", "levelId") REFERENCES "item"("id", "levelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_value" ADD CONSTRAINT "attribute_value_fieldId_levelId_fkey" FOREIGN KEY ("fieldId", "levelId") REFERENCES "field"("id", "levelId") ON DELETE CASCADE ON UPDATE CASCADE;
