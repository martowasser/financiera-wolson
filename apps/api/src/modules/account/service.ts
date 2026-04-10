import prisma from '../../lib/prisma.js';
import { notFound, conflict, unprocessable } from '../../lib/errors.js';

// ─── List accounts with optional filters ────────────────────────────────────

interface ListFilters {
  entityId?: string;
  type?: string;
  currency?: string;
  search?: string;
}

export async function list(filters: ListFilters = {}) {
  const where: Record<string, unknown> = { deletedAt: null };

  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.type) where.type = filters.type;
  if (filters.currency) where.currency = filters.currency;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { path: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const accounts = await prisma.account.findMany({
    where,
    include: { entity: true },
    orderBy: { path: 'asc' },
  });

  return accounts.map((account) => ({
    ...account,
    balance: computeBalance(account),
  }));
}

// ─── Get account by ID ──────────────────────────────────────────────────────

export async function getById(id: string) {
  const account = await prisma.account.findUnique({
    where: { id },
    include: { entity: true },
  });

  if (!account) {
    throw notFound('Cuenta no encontrada');
  }

  return account;
}

// ─── Get accounts by path prefix (hierarchy query) ──────────────────────────

export async function getByPath(pathPrefix: string) {
  const accounts = await prisma.account.findMany({
    where: {
      path: { startsWith: pathPrefix },
      deletedAt: null,
    },
    include: { entity: true },
    orderBy: { path: 'asc' },
  });

  return accounts.map((account) => ({
    ...account,
    balance: computeBalance(account),
  }));
}

// ─── Create account ─────────────────────────────────────────────────────────

interface CreateAccountData {
  entityId: string;
  name: string;
  path: string;
  type: string;
  currency: string;
  normalBalance: string;
  bankName?: string | null;
  bankAccountNum?: string | null;
}

export async function create(data: CreateAccountData) {
  if (!data.path.includes(':')) {
    throw unprocessable(
      'El path debe contener ":" como separador de jerarquía (ej: "ACTIVO:CAJA:ARS")',
      'INVALID_PATH_FORMAT',
    );
  }

  const existing = await prisma.account.findUnique({ where: { path: data.path } });
  if (existing) {
    throw conflict('Ya existe una cuenta con este path', 'ACCOUNT_PATH_EXISTS', { path: data.path });
  }

  const account = await prisma.account.create({
    data: {
      entityId: data.entityId,
      name: data.name,
      path: data.path,
      type: data.type as any,
      currency: data.currency as any,
      normalBalance: data.normalBalance as any,
      bankName: data.bankName,
      bankAccountNum: data.bankAccountNum,
    },
    include: { entity: true },
  });

  return account;
}

// ─── Update account (path is immutable) ─────────────────────────────────────

interface UpdateAccountData {
  name?: string;
  bankName?: string | null;
  bankAccountNum?: string | null;
  isActive?: boolean;
}

export async function update(id: string, data: UpdateAccountData) {
  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Cuenta no encontrada');
  }

  const account = await prisma.account.update({
    where: { id },
    data,
    include: { entity: true },
  });

  return account;
}

// ─── Soft delete account ────────────────────────────────────────────────────

export async function softDelete(id: string) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) {
    throw notFound('Cuenta no encontrada');
  }

  const entriesCount = await prisma.entry.count({
    where: { accountId: id },
  });

  if (entriesCount > 0) {
    throw conflict(
      'No se puede eliminar una cuenta que tiene entries registrados',
      'ACCOUNT_HAS_ENTRIES',
      { entriesCount },
    );
  }

  const deleted = await prisma.account.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });

  return deleted;
}

// ─── Get account balance ────────────────────────────────────────────────────

export async function getBalance(id: string) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) {
    throw notFound('Cuenta no encontrada');
  }

  return {
    debitsPosted: account.debitsPosted,
    creditsPosted: account.creditsPosted,
    balance: computeBalance(account),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeBalance(account: { normalBalance: string; debitsPosted: bigint; creditsPosted: bigint }): bigint {
  if (account.normalBalance === 'DEBIT') {
    return account.debitsPosted - account.creditsPosted;
  }
  return account.creditsPosted - account.debitsPosted;
}
