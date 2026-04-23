import prisma from '../../lib/prisma.js';
import { notFound, unprocessable, conflict } from '../../lib/errors.js';

export async function listBySociedad(sociedadId: string) {
  return prisma.sociedadMember.findMany({
    where: { sociedadId },
    include: { account: true },
    orderBy: [{ percentBps: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function validateSum(sociedadId: string) {
  const members = await prisma.sociedadMember.findMany({
    where: { sociedadId },
    include: { account: true },
  });
  const byCurrency = new Map<string, number>();
  for (const m of members) {
    if (m.account.type !== 'OWNER_CURRENT') continue;
    const curr = m.account.currency as string;
    byCurrency.set(curr, (byCurrency.get(curr) ?? 0) + m.percentBps);
  }
  const breakdown = Array.from(byCurrency.entries()).map(([currency, totalBps]) => ({
    currency,
    totalBps,
    valid: totalBps === 10000,
  }));
  const valid = breakdown.length === 0 ? false : breakdown.every((b) => b.valid);
  return { valid, breakdown };
}

export async function create(data: {
  sociedadId: string;
  accountId: string;
  percentBps: number;
}) {
  const sociedad = await prisma.entity.findUnique({ where: { id: data.sociedadId } });
  if (!sociedad) throw notFound('Sociedad no encontrada');
  if (sociedad.type !== 'COMPANY') {
    throw unprocessable('La entidad no es una sociedad (type=COMPANY)', 'NOT_A_SOCIEDAD');
  }

  const account = await prisma.account.findUnique({ where: { id: data.accountId } });
  if (!account) throw notFound('Cuenta no encontrada');
  if (account.type !== 'OWNER_CURRENT' && account.type !== 'BANK') {
    throw unprocessable(
      'Sólo se pueden asociar cuentas OWNER_CURRENT o BANK a una sociedad',
      'INVALID_ACCOUNT_TYPE',
    );
  }
  if (account.type === 'BANK' && data.percentBps !== 0) {
    throw unprocessable(
      'Las cuentas BANK asociadas a la sociedad deben tener % = 0',
      'BANK_PERCENT_MUST_BE_ZERO',
    );
  }

  const existing = await prisma.sociedadMember.findUnique({
    where: { sociedadId_accountId: { sociedadId: data.sociedadId, accountId: data.accountId } },
  });
  if (existing) {
    throw conflict('Esa cuenta ya está asociada a la sociedad', 'DUPLICATE_MEMBER');
  }

  return prisma.sociedadMember.create({
    data: {
      sociedadId: data.sociedadId,
      accountId: data.accountId,
      percentBps: data.percentBps,
    },
    include: { account: true },
  });
}

export async function update(id: string, data: { percentBps: number }) {
  const member = await prisma.sociedadMember.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!member) throw notFound('Miembro no encontrado');
  if (member.account.type === 'BANK' && data.percentBps !== 0) {
    throw unprocessable(
      'Las cuentas BANK asociadas a la sociedad deben tener % = 0',
      'BANK_PERCENT_MUST_BE_ZERO',
    );
  }

  return prisma.sociedadMember.update({
    where: { id },
    data: { percentBps: data.percentBps },
    include: { account: true },
  });
}

export async function remove(id: string) {
  const member = await prisma.sociedadMember.findUnique({ where: { id } });
  if (!member) throw notFound('Miembro no encontrado');
  return prisma.sociedadMember.delete({ where: { id } });
}
