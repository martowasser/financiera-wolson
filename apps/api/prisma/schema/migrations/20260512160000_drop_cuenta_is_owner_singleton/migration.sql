-- Una persona puede tener N cuentas (decisión #15 del plan rebuild 2026-04-23).
-- Sacamos la restricción de "un solo isOwner=true por sistema".
DROP INDEX IF EXISTS "Cuenta_isOwner_singleton";
