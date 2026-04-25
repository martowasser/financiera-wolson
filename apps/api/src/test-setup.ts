import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargamos .env.test ANTES de cualquier import de @prisma/client. Si no, el
// prisma compartido (src/lib/prisma.ts) hace `new PrismaClient()` sin URL, y
// resuelve DATABASE_URL contra la `.env` de dev — terminando por escribir tests
// en la DB de desarrollo. `override: true` gana contra cualquier .env previo.
loadEnv({ path: path.resolve(__dirname, '..', '.env.test'), override: true });

const { PrismaClient } = await import('@prisma/client');
const { execSync } = await import('child_process');

const TEST_URL = process.env.DATABASE_URL!;

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
