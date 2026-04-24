import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_URL = process.env.DATABASE_URL || 'postgresql://financiero:financiero_test@localhost:5435/financiero_test?schema=public';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });

beforeAll(async () => {
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'pipe',
  });
});

beforeEach(async () => {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.movimiento.deleteMany(),
    prisma.cajaDia.deleteMany(),
    prisma.contratoSocio.deleteMany(),
    prisma.contrato.deleteMany(),
    prisma.propiedad.deleteMany(),
    prisma.banco.deleteMany(),
    prisma.sociedadSocio.deleteMany(),
    prisma.sociedad.deleteMany(),
    prisma.cuenta.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
