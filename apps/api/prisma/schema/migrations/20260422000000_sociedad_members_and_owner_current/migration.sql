-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'OWNER_CURRENT';

-- AlterTable: sociedadId on Transaction
ALTER TABLE "Transaction" ADD COLUMN "sociedadId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_sociedadId_idx" ON "Transaction"("sociedadId");

-- AddForeignKey
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_sociedadId_fkey"
  FOREIGN KEY ("sociedadId") REFERENCES "Entity"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SociedadMember" (
    "id" TEXT NOT NULL,
    "sociedadId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "percentBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SociedadMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SociedadMember_sociedadId_accountId_key"
  ON "SociedadMember"("sociedadId", "accountId");
CREATE INDEX "SociedadMember_sociedadId_idx" ON "SociedadMember"("sociedadId");
CREATE INDEX "SociedadMember_accountId_idx" ON "SociedadMember"("accountId");

-- AddForeignKey
ALTER TABLE "SociedadMember"
  ADD CONSTRAINT "SociedadMember_sociedadId_fkey"
  FOREIGN KEY ("sociedadId") REFERENCES "Entity"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SociedadMember"
  ADD CONSTRAINT "SociedadMember_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
