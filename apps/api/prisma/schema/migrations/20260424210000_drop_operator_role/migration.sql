-- Reasigna a ADMIN cualquier user existente con role=OPERATOR antes de bajar el valor del enum.
UPDATE "User" SET "role" = 'ADMIN' WHERE "role" = 'OPERATOR';

-- Postgres no permite DROP de valores de enum; hay que rotar el tipo.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole"
  USING ("role"::text::"UserRole");
DROP TYPE "UserRole_old";
