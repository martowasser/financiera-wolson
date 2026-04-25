-- Bajamos el valor ALQUILER_PAGO del enum MovimientoTipo. No debería haber rows
-- usándolo (verificado a mano antes de generar la migración), pero el UPDATE
-- queda como red de seguridad — caen a OTRO con notes explicativas si aparecen.
UPDATE "Movimiento"
   SET "tipo" = 'OTRO',
       "notes" = COALESCE("notes" || E'\n', '') || '[migrated from ALQUILER_PAGO]'
 WHERE "tipo" = 'ALQUILER_PAGO';

-- Postgres no permite DROP de valores de enum; rotamos el tipo.
ALTER TYPE "MovimientoTipo" RENAME TO "MovimientoTipo_old";
CREATE TYPE "MovimientoTipo" AS ENUM (
  'ALQUILER_COBRO',
  'GASTO',
  'GASTO_SOCIEDAD',
  'GASTO_PROPIEDAD',
  'INGRESO_VARIO',
  'TRANSFERENCIA',
  'COMISION_BANCARIA',
  'DEBITO_AUTOMATICO',
  'RECUPERO',
  'AJUSTE',
  'OTRO'
);
ALTER TABLE "Movimiento"
  ALTER COLUMN "tipo" TYPE "MovimientoTipo"
  USING ("tipo"::text::"MovimientoTipo");
DROP TYPE "MovimientoTipo_old";
