-- CreateEnum
CREATE TYPE "CajaStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContratoStatus" AS ENUM ('ACTIVO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "BucketTipo" AS ENUM ('CAJA', 'BANCO', 'CUENTA_CORRIENTE');

-- CreateEnum
CREATE TYPE "MovimientoTipo" AS ENUM ('ALQUILER_COBRO', 'ALQUILER_PAGO', 'GASTO', 'GASTO_SOCIEDAD', 'GASTO_PROPIEDAD', 'INGRESO_VARIO', 'TRANSFERENCIA', 'COMISION_BANCARIA', 'DEBITO_AUTOMATICO', 'RECUPERO', 'AJUSTE', 'OTRO');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banco" (
    "id" TEXT NOT NULL,
    "sociedadId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "saldoArs" BIGINT NOT NULL DEFAULT 0,
    "saldoUsd" BIGINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Banco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CajaDia" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "status" "CajaStatus" NOT NULL DEFAULT 'OPEN',
    "saldoInicialArs" BIGINT NOT NULL DEFAULT 0,
    "saldoInicialUsd" BIGINT NOT NULL DEFAULT 0,
    "saldoFinalArs" BIGINT,
    "saldoFinalUsd" BIGINT,
    "cerradoEn" TIMESTAMP(3),
    "cerradoPorId" TEXT,
    "notes" TEXT,

    CONSTRAINT "CajaDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "inquilinoId" TEXT NOT NULL,
    "monto" BIGINT NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE,
    "status" "ContratoStatus" NOT NULL DEFAULT 'ACTIVO',
    "finalizadoEn" DATE,
    "motivoFinalizacion" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoSocio" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "percentBps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContratoSocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT,
    "notes" TEXT,
    "saldoArs" BIGINT NOT NULL DEFAULT 0,
    "saldoUsd" BIGINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "cajaDiaId" TEXT NOT NULL,
    "tipo" "MovimientoTipo" NOT NULL,
    "monto" BIGINT NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "origenBucket" "BucketTipo",
    "origenBancoId" TEXT,
    "origenCuentaId" TEXT,
    "destinoBucket" "BucketTipo",
    "destinoBancoId" TEXT,
    "destinoCuentaId" TEXT,
    "sociedadId" TEXT,
    "propiedadId" TEXT,
    "contratoId" TEXT,
    "cuentaContraparteId" TEXT,
    "comprobante" TEXT,
    "facturado" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "reversoDeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Propiedad" (
    "id" TEXT NOT NULL,
    "sociedadId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "descripcion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sociedad" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Sociedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SociedadSocio" (
    "id" TEXT NOT NULL,
    "sociedadId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "percentBps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SociedadSocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Banco_sociedadId_key" ON "Banco"("sociedadId");

-- CreateIndex
CREATE INDEX "Banco_sociedadId_idx" ON "Banco"("sociedadId");

-- CreateIndex
CREATE INDEX "Banco_numero_idx" ON "Banco"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "CajaDia_fecha_key" ON "CajaDia"("fecha");

-- CreateIndex
CREATE INDEX "CajaDia_fecha_idx" ON "CajaDia"("fecha");

-- CreateIndex
CREATE INDEX "CajaDia_status_idx" ON "CajaDia"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_numero_key" ON "Contrato"("numero");

-- CreateIndex
CREATE INDEX "Contrato_status_idx" ON "Contrato"("status");

-- CreateIndex
CREATE INDEX "Contrato_fechaInicio_idx" ON "Contrato"("fechaInicio");

-- CreateIndex
CREATE INDEX "Contrato_inquilinoId_idx" ON "Contrato"("inquilinoId");

-- CreateIndex
CREATE INDEX "Contrato_propiedadId_idx" ON "Contrato"("propiedadId");

-- CreateIndex
CREATE INDEX "Contrato_numero_idx" ON "Contrato"("numero");

-- CreateIndex
CREATE INDEX "ContratoSocio_contratoId_idx" ON "ContratoSocio"("contratoId");

-- CreateIndex
CREATE INDEX "ContratoSocio_cuentaId_idx" ON "ContratoSocio"("cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "ContratoSocio_contratoId_cuentaId_key" ON "ContratoSocio"("contratoId", "cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "Cuenta_identifier_key" ON "Cuenta"("identifier");

-- CreateIndex
CREATE INDEX "Cuenta_name_idx" ON "Cuenta"("name");

-- CreateIndex
CREATE INDEX "Cuenta_identifier_idx" ON "Cuenta"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Movimiento_numero_key" ON "Movimiento"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Movimiento_reversoDeId_key" ON "Movimiento"("reversoDeId");

-- CreateIndex
CREATE INDEX "Movimiento_fecha_idx" ON "Movimiento"("fecha");

-- CreateIndex
CREATE INDEX "Movimiento_cajaDiaId_idx" ON "Movimiento"("cajaDiaId");

-- CreateIndex
CREATE INDEX "Movimiento_sociedadId_idx" ON "Movimiento"("sociedadId");

-- CreateIndex
CREATE INDEX "Movimiento_propiedadId_idx" ON "Movimiento"("propiedadId");

-- CreateIndex
CREATE INDEX "Movimiento_contratoId_idx" ON "Movimiento"("contratoId");

-- CreateIndex
CREATE INDEX "Movimiento_tipo_idx" ON "Movimiento"("tipo");

-- CreateIndex
CREATE INDEX "Movimiento_numero_idx" ON "Movimiento"("numero");

-- CreateIndex
CREATE INDEX "Movimiento_origenBancoId_idx" ON "Movimiento"("origenBancoId");

-- CreateIndex
CREATE INDEX "Movimiento_destinoBancoId_idx" ON "Movimiento"("destinoBancoId");

-- CreateIndex
CREATE INDEX "Movimiento_origenCuentaId_idx" ON "Movimiento"("origenCuentaId");

-- CreateIndex
CREATE INDEX "Movimiento_destinoCuentaId_idx" ON "Movimiento"("destinoCuentaId");

-- CreateIndex
CREATE INDEX "Propiedad_sociedadId_idx" ON "Propiedad"("sociedadId");

-- CreateIndex
CREATE INDEX "Propiedad_nombre_idx" ON "Propiedad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Sociedad_name_key" ON "Sociedad"("name");

-- CreateIndex
CREATE INDEX "Sociedad_name_idx" ON "Sociedad"("name");

-- CreateIndex
CREATE INDEX "SociedadSocio_sociedadId_idx" ON "SociedadSocio"("sociedadId");

-- CreateIndex
CREATE INDEX "SociedadSocio_cuentaId_idx" ON "SociedadSocio"("cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "SociedadSocio_sociedadId_cuentaId_key" ON "SociedadSocio"("sociedadId", "cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banco" ADD CONSTRAINT "Banco_sociedadId_fkey" FOREIGN KEY ("sociedadId") REFERENCES "Sociedad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CajaDia" ADD CONSTRAINT "CajaDia_cerradoPorId_fkey" FOREIGN KEY ("cerradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "Propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_inquilinoId_fkey" FOREIGN KEY ("inquilinoId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoSocio" ADD CONSTRAINT "ContratoSocio_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoSocio" ADD CONSTRAINT "ContratoSocio_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_reversoDeId_fkey" FOREIGN KEY ("reversoDeId") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cajaDiaId_fkey" FOREIGN KEY ("cajaDiaId") REFERENCES "CajaDia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_origenBancoId_fkey" FOREIGN KEY ("origenBancoId") REFERENCES "Banco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_destinoBancoId_fkey" FOREIGN KEY ("destinoBancoId") REFERENCES "Banco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_origenCuentaId_fkey" FOREIGN KEY ("origenCuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_destinoCuentaId_fkey" FOREIGN KEY ("destinoCuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cuentaContraparteId_fkey" FOREIGN KEY ("cuentaContraparteId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_sociedadId_fkey" FOREIGN KEY ("sociedadId") REFERENCES "Sociedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "Propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Propiedad" ADD CONSTRAINT "Propiedad_sociedadId_fkey" FOREIGN KEY ("sociedadId") REFERENCES "Sociedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SociedadSocio" ADD CONSTRAINT "SociedadSocio_sociedadId_fkey" FOREIGN KEY ("sociedadId") REFERENCES "Sociedad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SociedadSocio" ADD CONSTRAINT "SociedadSocio_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
