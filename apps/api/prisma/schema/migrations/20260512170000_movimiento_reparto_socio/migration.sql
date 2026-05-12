-- Reparto a CC de socios: cuando un mov toca BANCO (ingresos siempre, egresos
-- según el reparto que pasa el caller), se generan filas hijas REPARTO_SOCIO
-- que actualizan cuenta.saldoArs/Usd.

ALTER TYPE "MovimientoTipo" ADD VALUE 'REPARTO_SOCIO';

ALTER TABLE "Movimiento"
  ADD COLUMN "derivadoDeId" TEXT;

ALTER TABLE "Movimiento"
  ADD CONSTRAINT "Movimiento_derivadoDeId_fkey"
  FOREIGN KEY ("derivadoDeId") REFERENCES "Movimiento"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Movimiento_derivadoDeId_idx" ON "Movimiento"("derivadoDeId");
