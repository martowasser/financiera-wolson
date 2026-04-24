// Seed mínimo: 3 usuarios + 1 cuenta raíz "Financiera".
// Mariana carga el resto en la demo.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin123', 12);

  await prisma.user.createMany({
    data: [
      { username: 'admin', password, name: 'Administrador', role: 'ADMIN' },
      { username: 'mariana', password, name: 'Mariana', role: 'OPERATOR' },
      { username: 'alberto', password, name: 'Alberto', role: 'VIEWER' },
    ],
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
  console.log('Login: admin / mariana / alberto (password: admin123).');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
