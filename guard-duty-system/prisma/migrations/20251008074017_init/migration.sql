-- CreateTable
CREATE TABLE "GuardPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "shiftLength" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Guard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rank" TEXT,
    "totalHours" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Guard_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "GuardPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "postType" TEXT NOT NULL,
    "shiftType" TEXT NOT NULL,
    "isSpecial" BOOLEAN NOT NULL DEFAULT false,
    "specialType" TEXT,
    "peopleCount" INTEGER NOT NULL DEFAULT 1,
    "periodId" TEXT NOT NULL,
    "guardId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shift_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "GuardPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Shift_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivitySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "description" TEXT,
    "periodId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivitySession_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "GuardPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "postType" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityShift_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ActivitySession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityShift_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Guard_periodId_name_key" ON "Guard"("periodId", "name");

-- CreateIndex
CREATE INDEX "Shift_periodId_startTime_idx" ON "Shift"("periodId", "startTime");

-- CreateIndex
CREATE INDEX "ActivityShift_activityId_startTime_idx" ON "ActivityShift"("activityId", "startTime");
