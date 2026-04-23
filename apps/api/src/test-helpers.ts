import prisma from './lib/prisma.js';
import bcrypt from 'bcrypt';
import { signAccessToken, type JwtPayload } from './lib/auth-middleware.js';

// ─── Data Factories ──────────────────────────────────────────────────────

export async function createTestUser(overrides?: Partial<{
  username: string; name: string; role: 'ADMIN' | 'OPERATOR' | 'VIEWER'; password: string; isActive: boolean;
}>) {
  return prisma.user.create({
    data: {
      username: overrides?.username ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      password: await bcrypt.hash(overrides?.password ?? 'password123', 4),
      name: overrides?.name ?? 'Test User',
      role: overrides?.role ?? 'ADMIN',
      isActive: overrides?.isActive ?? true,
    },
  });
}

export async function createTestEntity(overrides?: Partial<{
  name: string; type: 'COMPANY' | 'PERSON' | 'FIRM' | 'THIRD_PARTY'; taxId: string;
}>) {
  return prisma.entity.create({
    data: {
      name: overrides?.name ?? `Entity ${Date.now()}`,
      type: overrides?.type ?? 'COMPANY',
      taxId: overrides?.taxId ?? null,
    },
  });
}

export async function createTestAccount(entityId: string, overrides?: Partial<{
  name: string; path: string; type: string; currency: string;
  normalBalance: string; bankName: string; bankAccountNum: string;
}>) {
  return prisma.account.create({
    data: {
      entityId,
      name: overrides?.name ?? `Account ${Date.now()}`,
      path: overrides?.path ?? `TEST:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      type: (overrides?.type ?? 'CASH') as any,
      currency: (overrides?.currency ?? 'ARS') as any,
      normalBalance: (overrides?.normalBalance ?? 'DEBIT') as any,
      bankName: overrides?.bankName,
      bankAccountNum: overrides?.bankAccountNum,
    },
  });
}

export async function createTestAccounts(entityId: string) {
  const suffix = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const cashARS = await prisma.account.create({
    data: {
      entityId, name: 'Cash ARS', path: `Assets:Cash:ARS:${suffix}`,
      type: 'CASH', currency: 'ARS', normalBalance: 'DEBIT',
    },
  });
  const incomeARS = await prisma.account.create({
    data: {
      entityId, name: 'Income ARS', path: `Income:Rental:ARS:${suffix}`,
      type: 'REVENUE', currency: 'ARS', normalBalance: 'CREDIT',
    },
  });
  const expenseARS = await prisma.account.create({
    data: {
      entityId, name: 'Expense ARS', path: `Expense:General:ARS:${suffix}`,
      type: 'EXPENSE', currency: 'ARS', normalBalance: 'DEBIT',
    },
  });
  const bankARS = await prisma.account.create({
    data: {
      entityId, name: 'Bank ARS', path: `Assets:Bank:Test:ARS:${suffix}`,
      type: 'BANK', currency: 'ARS', normalBalance: 'DEBIT',
    },
  });
  const receivableARS = await prisma.account.create({
    data: {
      entityId, name: 'Receivable ARS', path: `Assets:Receivable:ARS:${suffix}`,
      type: 'RECEIVABLE', currency: 'ARS', normalBalance: 'DEBIT',
    },
  });
  return { cashARS, incomeARS, expenseARS, bankARS, receivableARS };
}

export async function createTestPeriod(overrides?: Partial<{ month: number; year: number; status: string }>) {
  const now = new Date();
  const month = overrides?.month ?? now.getMonth() + 1;
  const year = overrides?.year ?? now.getFullYear();
  const date = new Date(year, month - 1, 1);
  date.setUTCHours(0, 0, 0, 0);
  return prisma.period.create({
    data: {
      date,
      status: (overrides?.status ?? 'OPEN') as any,
    },
  });
}

export async function createTestProperty(entityId: string, overrides?: Partial<{
  name: string; address: string; type: string;
}>) {
  return prisma.property.create({
    data: {
      entityId,
      name: overrides?.name ?? `Property ${Date.now()}`,
      address: overrides?.address ?? '123 Test St',
      type: (overrides?.type ?? 'APARTMENT') as any,
    },
  });
}

export async function createTestLease(overrides: {
  propertyId: string; tenantId: string;
  startDate?: Date; endDate?: Date; currency?: string; baseAmount?: number | bigint;
  managedBy?: string; thirdPartyEntityId?: string;
}) {
  return prisma.lease.create({
    data: {
      propertyId: overrides.propertyId,
      tenantId: overrides.tenantId,
      startDate: overrides.startDate ?? new Date(),
      endDate: overrides.endDate ?? new Date(Date.now() + 365 * 86400000),
      currency: (overrides.currency ?? 'ARS') as any,
      baseAmount: BigInt(overrides.baseAmount ?? 100000),
      managedBy: (overrides.managedBy ?? 'DIRECT') as any,
      thirdPartyEntityId: overrides.thirdPartyEntityId,
      isActive: true,
    },
  });
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────

export function getAuthToken(user: { id: string; username: string; role: string }): string {
  return signAccessToken({
    userId: user.id,
    username: user.username,
    role: user.role as JwtPayload['role'],
  });
}

export function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

export { prisma };
