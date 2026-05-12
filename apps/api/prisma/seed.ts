// Seed mínimo: 3 usuarios + 1 cuenta raíz "Financiera".
// Mariana carga el resto en la demo.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const users = [
    { username: 'admin', password: 'admin123', name: 'Administrador', role: 'ADMIN' as const },
    { username: 'mariana', password: 'mariana123', name: 'Mariana', role: 'ADMIN' as const },
    { username: 'alberto', password: 'alberto123', name: 'Alberto', role: 'VIEWER' as const },
  ];

  await prisma.user.createMany({
    data: await Promise.all(
      users.map(async (u) => ({
        username: u.username,
        password: await bcrypt.hash(u.password, 12),
        name: u.name,
        role: u.role,
      })),
    ),
    skipDuplicates: true,
  });

  await prisma.cuenta.upsert({
    where: { identifier: 'FIN' },
    update: {},
    create: {
      name: 'Financiera (casa matriz)',
      identifier: 'FIN',
      notes: 'Entidad raíz del sistema.',
    },
  });

  console.log('Seed mínimo completado: 3 usuarios + 1 cuenta Financiera.');
  console.log('Login: admin/admin123 · mariana/mariana123 · alberto/alberto123.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
