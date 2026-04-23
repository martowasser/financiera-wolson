import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://financiero:financiero_test@localhost:5435/financiero_test?schema=public',
    },
  },
});

beforeAll(async () => {
  // Apply migrations to test DB
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://financiero:financiero_test@localhost:5435/financiero_test?schema=public',
    },
    stdio: 'pipe',
  });
});

beforeEach(async () => {
  // Clean all tables in correct order (respecting FKs)
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
    prisma.sociedadMember.deleteMany(),
    prisma.account.deleteMany(),
    prisma.period.deleteMany(),
    prisma.entity.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
