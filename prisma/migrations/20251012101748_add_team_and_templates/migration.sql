-- AlterTable
ALTER TABLE "Guard" ADD COLUMN     "team" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "GuardTemplate" (
    "id" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "guards" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuardTemplate_templateName_key" ON "GuardTemplate"("templateName");
