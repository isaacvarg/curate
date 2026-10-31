-- AlterEnum
ALTER TYPE "field_kind" ADD VALUE 'rating';

-- Hand-written: an Overall Rating exists with a Rating field value alone, so
-- the Verdict is a number, a label, or neither, never both.
ALTER TABLE "overall_rating" DROP CONSTRAINT "overall_rating_verdict_check";
ALTER TABLE "overall_rating" ADD CONSTRAINT "overall_rating_verdict_check" CHECK (num_nonnulls("verdictNumber", "verdictLabel") <= 1);

-- CreateTable
CREATE TABLE "overall_rating_value" (
    "id" TEXT NOT NULL,
    "overallRatingId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "valueNumber" DOUBLE PRECISION,
    "valueLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overall_rating_value_pkey" PRIMARY KEY ("id"),
    -- Hand-written: a value is either a number (numeric scale) or a label
    -- (label scale), never both or neither.
    CONSTRAINT "overall_rating_value_check" CHECK (num_nonnulls("valueNumber", "valueLabel") = 1)
);

-- CreateIndex
CREATE INDEX "overall_rating_value_fieldId_idx" ON "overall_rating_value"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "overall_rating_value_overallRatingId_fieldId_key" ON "overall_rating_value"("overallRatingId", "fieldId");

-- AddForeignKey
ALTER TABLE "overall_rating_value" ADD CONSTRAINT "overall_rating_value_overallRatingId_fkey" FOREIGN KEY ("overallRatingId") REFERENCES "overall_rating"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overall_rating_value" ADD CONSTRAINT "overall_rating_value_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "field"("id") ON DELETE CASCADE ON UPDATE CASCADE;
