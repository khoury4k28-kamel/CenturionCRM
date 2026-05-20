-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stage" TEXT NOT NULL DEFAULT 'NEW_LEAD',
    "propertyId" TEXT NOT NULL,
    "sellerId" TEXT,
    "realtorId" TEXT,
    "askingPrice" DECIMAL,
    "ourOffer" DECIMAL,
    "agreedPrice" DECIMAL,
    "listPrice" DECIMAL,
    "acceptanceDate" DATETIME,
    "expirationDate" DATETIME,
    "termOfAgreement" TEXT,
    "amountOwed" DECIMAL,
    "weOwn" BOOLEAN NOT NULL DEFAULT false,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "agreementType" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deal_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Deal" ("agreedPrice", "agreementType", "askingPrice", "createdAt", "createdById", "id", "notes", "ourOffer", "propertyId", "realtorId", "sellerId", "source", "stage", "updatedAt") SELECT "agreedPrice", "agreementType", "askingPrice", "createdAt", "createdById", "id", "notes", "ourOffer", "propertyId", "realtorId", "sellerId", "source", "stage", "updatedAt" FROM "Deal";
DROP TABLE "Deal";
ALTER TABLE "new_Deal" RENAME TO "Deal";
CREATE UNIQUE INDEX "Deal_propertyId_key" ON "Deal"("propertyId");
CREATE INDEX "Deal_stage_idx" ON "Deal"("stage");
CREATE INDEX "Deal_updatedAt_idx" ON "Deal"("updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
