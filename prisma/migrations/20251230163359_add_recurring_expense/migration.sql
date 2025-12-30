-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "profitCenter" TEXT NOT NULL DEFAULT 'OTHER',
    "seasonType" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "interval" INTEGER NOT NULL DEFAULT 1,
    "nextRunAt" DATETIME NOT NULL,
    "lastRunAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringExpense_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancialEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "reservationId" TEXT,
    "recurringExpenseId" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "profitCenter" TEXT NOT NULL,
    "roomCategory" TEXT,
    "packageType" TEXT,
    "description" TEXT,
    "grossAmount" DECIMAL,
    "netAmount" DECIMAL NOT NULL,
    "taxAmount" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "seasonType" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialEntry_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialEntry_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialEntry_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FinancialEntry" ("category", "createdAt", "currency", "description", "grossAmount", "hotelId", "id", "netAmount", "occurredAt", "packageType", "profitCenter", "reservationId", "roomCategory", "seasonType", "source", "taxAmount", "type") SELECT "category", "createdAt", "currency", "description", "grossAmount", "hotelId", "id", "netAmount", "occurredAt", "packageType", "profitCenter", "reservationId", "roomCategory", "seasonType", "source", "taxAmount", "type" FROM "FinancialEntry";
DROP TABLE "FinancialEntry";
ALTER TABLE "new_FinancialEntry" RENAME TO "FinancialEntry";
CREATE INDEX "FinancialEntry_hotelId_occurredAt_idx" ON "FinancialEntry"("hotelId", "occurredAt");
CREATE INDEX "FinancialEntry_recurringExpenseId_idx" ON "FinancialEntry"("recurringExpenseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RecurringExpense_hotelId_nextRunAt_idx" ON "RecurringExpense"("hotelId", "nextRunAt");
