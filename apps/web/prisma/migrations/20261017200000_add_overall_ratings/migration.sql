-- CreateTable
CREATE TABLE "overall_rating" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verdictNumber" DOUBLE PRECISION,
    "verdictLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overall_rating_pkey" PRIMARY KEY ("id"),
    -- Hand-written: the Verdict is either a number (numeric scale) or a label
    -- (label scale), never both or neither.
    CONSTRAINT "overall_rating_verdict_check" CHECK (num_nonnulls("verdictNumber", "verdictLabel") = 1)
);

-- CreateIndex
CREATE INDEX "overall_rating_userId_idx" ON "overall_rating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "overall_rating_itemId_userId_key" ON "overall_rating"("itemId", "userId");

-- AddForeignKey
ALTER TABLE "overall_rating" ADD CONSTRAINT "overall_rating_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overall_rating" ADD CONSTRAINT "overall_rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
