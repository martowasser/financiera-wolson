import prisma from './lib/prisma.js';
import bcrypt from 'bcrypt';
import { signAccessToken, type JwtPayload } from './lib/auth-middleware.js';

export async function createTestUser(overrides?: Partial<{
  username: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  password: string;
  isActive: boolean;
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

export async function createTestCuenta(overrides?: Partial<{
  name: string;
  identifier: string;
  notes: string;
}>) {
  return prisma.cuenta.create({
    data: {
      name: overrides?.name ?? `Cuenta ${Date.now()}`,
      identifier: overrides?.identifier,
      notes: overrides?.notes,
    },
  });
}

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
