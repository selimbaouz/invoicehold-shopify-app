-- CreateTable
CREATE TABLE "ShopSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "holdHours" INTEGER NOT NULL DEFAULT 72,
    "trigger" TEXT NOT NULL DEFAULT 'invoice_sent',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "draftOrderId" TEXT NOT NULL,
    "draftOrderName" TEXT,
    "invoiceEmail" TEXT,
    "quantitySummary" INTEGER NOT NULL DEFAULT 0,
    "lineItemsJson" TEXT,
    "reservedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "draftOrderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopSetting_shop_key" ON "ShopSetting"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Hold_shop_draftOrderId_key" ON "Hold"("shop", "draftOrderId");

-- CreateIndex
CREATE INDEX "Hold_shop_status_idx" ON "Hold"("shop", "status");

-- CreateIndex
CREATE INDEX "SyncLog_shop_draftOrderId_idx" ON "SyncLog"("shop", "draftOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_shop_eventId_key" ON "ProcessedEvent"("shop", "eventId");
