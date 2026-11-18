-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WithdrawalEventType" AS ENUM ('CREATED', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WITHDRAWAL_UPDATE';

-- AlterEnum
ALTER TYPE "WalletTransactionReason" ADD VALUE 'WITHDRAWAL';

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "reservedBalance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "withdrawalId" UUID;

-- CreateTable
CREATE TABLE "ProviderBankAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "holderName" VARCHAR(120) NOT NULL,
    "iban" VARCHAR(26) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "ibanSnapshot" VARCHAR(26) NOT NULL,
    "holderNameSnapshot" VARCHAR(120) NOT NULL,
    "clientKey" UUID,
    "reviewedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "paidById" UUID,
    "paidAt" TIMESTAMP(3),
    "payoutReference" VARCHAR(64),
    "adminNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalEvent" (
    "id" UUID NOT NULL,
    "withdrawalId" UUID NOT NULL,
    "type" "WithdrawalEventType" NOT NULL,
    "actorId" UUID NOT NULL,
    "fromStatus" "WithdrawalStatus",
    "toStatus" "WithdrawalStatus" NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderBankAccount_userId_key" ON "ProviderBankAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequest_code_key" ON "WithdrawalRequest"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequest_payoutReference_key" ON "WithdrawalRequest"("payoutReference");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_createdAt_idx" ON "WithdrawalRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_userId_createdAt_idx" ON "WithdrawalRequest"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequest_userId_clientKey_key" ON "WithdrawalRequest"("userId", "clientKey");

-- CreateIndex
CREATE INDEX "WithdrawalEvent_withdrawalId_createdAt_idx" ON "WithdrawalEvent"("withdrawalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_withdrawalId_key" ON "WalletTransaction"("withdrawalId");

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderBankAccount" ADD CONSTRAINT "ProviderBankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalEvent" ADD CONSTRAINT "WithdrawalEvent_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalEvent" ADD CONSTRAINT "WithdrawalEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Financial invariants enforced by the database (not expressible in the Prisma schema).
-- Existing rows satisfy them: reservedBalance defaults to 0 and wallet balances are never negative.
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_reservedBalance_nonnegative" CHECK ("reservedBalance" >= 0);
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_balance_covers_reserved" CHECK ("balance" >= "reservedBalance");
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_amount_positive" CHECK ("amount" > 0);
