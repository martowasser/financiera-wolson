-- AlterTable
ALTER TABLE "Cuenta" ADD COLUMN     "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- Partial unique index: enforce at most one owner cuenta system-wide.
CREATE UNIQUE INDEX "Cuenta_isOwner_singleton" ON "Cuenta" ("isOwner") WHERE "isOwner" = true;
