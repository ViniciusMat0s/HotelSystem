-- CreateTable
CREATE TABLE "ExpenseInvoiceAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseInvoiceAudit_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ExpenseInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExpenseInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "billingPeriodStart" DATETIME,
    "billingPeriodEnd" DATETIME,
    "dueDate" DATETIME,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "paidAt" DATETIME,
    "emailMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    CONSTRAINT "ExpenseInvoice_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExpenseInvoice" ("amount", "billingPeriodEnd", "billingPeriodStart", "currency", "dueDate", "emailMessageId", "hotelId", "id", "invoiceNumber", "notes", "provider", "receivedAt", "status") SELECT "amount", "billingPeriodEnd", "billingPeriodStart", "currency", "dueDate", "emailMessageId", "hotelId", "id", "invoiceNumber", "notes", "provider", "receivedAt", "status" FROM "ExpenseInvoice";
DROP TABLE "ExpenseInvoice";
ALTER TABLE "new_ExpenseInvoice" RENAME TO "ExpenseInvoice";
CREATE TABLE "new_FinancialEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "reservationId" TEXT,
    "expenseInvoiceId" TEXT,
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
    CONSTRAINT "FinancialEntry_expenseInvoiceId_fkey" FOREIGN KEY ("expenseInvoiceId") REFERENCES "ExpenseInvoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialEntry_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FinancialEntry" ("category", "createdAt", "currency", "description", "grossAmount", "hotelId", "id", "netAmount", "occurredAt", "packageType", "profitCenter", "recurringExpenseId", "reservationId", "roomCategory", "seasonType", "source", "taxAmount", "type") SELECT "category", "createdAt", "currency", "description", "grossAmount", "hotelId", "id", "netAmount", "occurredAt", "packageType", "profitCenter", "recurringExpenseId", "reservationId", "roomCategory", "seasonType", "source", "taxAmount", "type" FROM "FinancialEntry";
DROP TABLE "FinancialEntry";
ALTER TABLE "new_FinancialEntry" RENAME TO "FinancialEntry";
CREATE INDEX "FinancialEntry_hotelId_occurredAt_idx" ON "FinancialEntry"("hotelId", "occurredAt");
CREATE INDEX "FinancialEntry_expenseInvoiceId_idx" ON "FinancialEntry"("expenseInvoiceId");
CREATE INDEX "FinancialEntry_recurringExpenseId_idx" ON "FinancialEntry"("recurringExpenseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ExpenseInvoiceAudit_invoiceId_createdAt_idx" ON "ExpenseInvoiceAudit"("invoiceId", "createdAt");
