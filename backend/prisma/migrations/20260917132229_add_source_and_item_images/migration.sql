-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'Private',
ALTER COLUMN "category" SET DEFAULT 'Medicine';

-- CreateTable
CREATE TABLE "ItemImage" (
    "name" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemImage_pkey" PRIMARY KEY ("name")
);
