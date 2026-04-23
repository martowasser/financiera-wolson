import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://financiero:financiero_test@localhost:5435/financiero_test?schema=public',
    },
  },
});

async function seed() {
  // Clean all tables
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.bankReconciliationItem.deleteMany(),
    prisma.bankReconciliation.deleteMany(),
    prisma.ownerSettlement.deleteMany(),
    prisma.invoiceRetention.deleteMany(),
    prisma.entry.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.leasePrice.deleteMany(),
    prisma.lease.deleteMany(),
    prisma.property.deleteMany(),
    prisma.ownership.deleteMany(),
    prisma.account.deleteMany(),
    prisma.period.deleteMany(),
    prisma.entity.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Create admin user
  await prisma.user.create({
    data: {
      username: 'e2e-admin',
      password: await bcrypt.hash('password123', 4),
      name: 'E2E Admin',
      role: 'ADMIN',
      isActive: true,
    },
  });

  // Create test entity
  const entity = await prisma.entity.create({
    data: { name: 'E2E Test Entity', type: 'FIRM' },
  });

  // Create accounts
  await prisma.account.createMany({
    data: [
      { entityId: entity.id, name: 'Caja ARS', path: 'ACTIVO:CAJA:ARS', type: 'CASH', currency: 'ARS', normalBalance: 'DEBIT' },
      { entityId: entity.id, name: 'Banco ARS', path: 'ACTIVO:BANCO:ARS', type: 'BANK', currency: 'ARS', normalBalance: 'DEBIT', bankName: 'Banco Test' },
      { entityId: entity.id, name: 'Ingresos ARS', path: 'INGRESO:ALQUILER:ARS', type: 'REVENUE', currency: 'ARS', normalBalance: 'CREDIT' },
      { entityId: entity.id, name: 'Gastos ARS', path: 'GASTO:GENERAL:ARS', type: 'EXPENSE', currency: 'ARS', normalBalance: 'DEBIT' },
      { entityId: entity.id, name: 'Cuentas a Cobrar', path: 'ACTIVO:CXC:ARS', type: 'RECEIVABLE', currency: 'ARS', normalBalance: 'DEBIT' },
    ],
  });

  await prisma.$disconnect();
  console.log('E2E seed complete');
}

seed().catch((e) => {
  console.error('E2E seed failed:', e);
  process.exit(1);
});
