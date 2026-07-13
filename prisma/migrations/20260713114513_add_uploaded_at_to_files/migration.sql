-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmployeeFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeFile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmployeeFile" ("createdAt", "description", "employeeId", "fileName", "fileSize", "id", "mimeType", "originalName", "uploadedById") SELECT "createdAt", "description", "employeeId", "fileName", "fileSize", "id", "mimeType", "originalName", "uploadedById" FROM "EmployeeFile";
DROP TABLE "EmployeeFile";
ALTER TABLE "new_EmployeeFile" RENAME TO "EmployeeFile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
