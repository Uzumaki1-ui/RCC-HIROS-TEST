-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LeaveType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "defaultDays" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LeaveType" ("id", "name", "code", "defaultDays", "active", "createdAt", "updatedAt") SELECT "id", "name", "code", "defaultDays", "active", "createdAt", "updatedAt" FROM "LeaveType";
DROP TABLE "LeaveType";
ALTER TABLE "new_LeaveType" RENAME TO "LeaveType";
CREATE UNIQUE INDEX "LeaveType_name_key" ON "LeaveType"("name");
CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
