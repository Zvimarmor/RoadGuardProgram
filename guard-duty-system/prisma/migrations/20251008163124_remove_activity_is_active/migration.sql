-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActivitySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "description" TEXT,
    "periodId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivitySession_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "GuardPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ActivitySession" ("createdAt", "description", "endTime", "id", "name", "periodId", "startTime", "updatedAt") SELECT "createdAt", "description", "endTime", "id", "name", "periodId", "startTime", "updatedAt" FROM "ActivitySession";
DROP TABLE "ActivitySession";
ALTER TABLE "new_ActivitySession" RENAME TO "ActivitySession";
CREATE TABLE "new_Guard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rank" TEXT NOT NULL DEFAULT '',
    "totalHours" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Guard_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "GuardPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Guard" ("createdAt", "id", "isActive", "joinedAt", "name", "periodId", "rank", "totalHours", "updatedAt") SELECT "createdAt", "id", "isActive", "joinedAt", "name", "periodId", coalesce("rank", '') AS "rank", "totalHours", "updatedAt" FROM "Guard";
DROP TABLE "Guard";
ALTER TABLE "new_Guard" RENAME TO "Guard";
CREATE UNIQUE INDEX "Guard_periodId_name_key" ON "Guard"("periodId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
