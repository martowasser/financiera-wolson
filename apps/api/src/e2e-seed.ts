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

  await prisma.user.create({
    data: {
      username: 'e2e-admin',
      password: await bcrypt.hash('password123', 4),
      name: 'E2E Admin',
      role: 'ADMIN',
      isActive: true,
    },
  });

  await prisma.$disconnect();
  console.log('E2E seed complete');
}

seed().catch((e) => {
  console.error('E2E seed failed:', e);
  process.exit(1);
});
