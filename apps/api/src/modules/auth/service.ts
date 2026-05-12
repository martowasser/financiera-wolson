import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import prisma from '../../lib/prisma.js';
import { signAccessToken, signRefreshToken, type JwtPayload } from '../../lib/auth-middleware.js';
import { notFound, unauthorized, conflict } from '../../lib/errors.js';
import type { UserRole } from '@prisma/client';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const ROTATION_GRACE_MS = 30 * 1000;

function excludePassword<T extends { password: string }>(user: T) {
  const { password, ...rest } = user;
  return rest;
}

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    throw unauthorized('Invalid username or password');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw unauthorized('Invalid username or password');
  }

  const jwtPayload: JwtPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const accessToken = signAccessToken(jwtPayload);
  const refreshTokenStr = crypto.randomBytes(48).toString('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.refreshToken.create({
    data: {
      token: refreshTokenStr,
      userId: user.id,
      expiresAt,
    },
  });

  return {
    user: excludePassword(user),
    accessToken,
    refreshToken: refreshTokenStr,
  };
}

export async function register(username: string, password: string, name: string, role: UserRole) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw conflict('A user with this username already exists');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      name,
      role,
    },
  });

  return excludePassword(user);
}

export async function refresh(refreshTokenStr: string) {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshTokenStr },
    include: { user: true },
  });

  if (!storedToken) {
    throw unauthorized('Invalid refresh token');
  }

  // Token already rotated. Inside the grace window we replay the same
  // successor tokens so concurrent refreshes (F5 spam, multiple tabs) don't
  // blow up the session. Outside the window it's a replay attack — kill all
  // of the user's refresh tokens.
  if (storedToken.rotatedAt) {
    const elapsedMs = Date.now() - storedToken.rotatedAt.getTime();
    if (elapsedMs > ROTATION_GRACE_MS) {
      await prisma.refreshToken.deleteMany({ where: { userId: storedToken.userId } });
      throw unauthorized('Refresh token reuse detected');
    }

    if (!storedToken.replacedById) {
      throw unauthorized('Invalid refresh token');
    }

    const replacement = await prisma.refreshToken.findUnique({
      where: { id: storedToken.replacedById },
      include: { user: true },
    });

    if (!replacement || !replacement.user.isActive) {
      throw unauthorized('Invalid refresh token');
    }

    const accessToken = signAccessToken({
      userId: replacement.user.id,
      username: replacement.user.username,
      role: replacement.user.role,
    });

    return {
      user: excludePassword(replacement.user),
      accessToken,
      refreshToken: replacement.token,
    };
  }

  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw unauthorized('Refresh token expired');
  }

  if (!storedToken.user.isActive) {
    throw unauthorized('User account is deactivated');
  }

  const jwtPayload: JwtPayload = {
    userId: storedToken.user.id,
    username: storedToken.user.username,
    role: storedToken.user.role,
  };

  const accessToken = signAccessToken(jwtPayload);
  const newRefreshTokenStr = crypto.randomBytes(48).toString('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  const newToken = await prisma.$transaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: {
        token: newRefreshTokenStr,
        userId: storedToken.user.id,
        expiresAt,
      },
    });
    // Conditional update guards against a concurrent caller already rotating
    // this token: if rotatedAt is no longer null, abort so the client falls
    // through to the grace path on retry.
    const result = await tx.refreshToken.updateMany({
      where: { id: storedToken.id, rotatedAt: null },
      data: {
        rotatedAt: new Date(),
        replacedById: created.id,
      },
    });
    if (result.count === 0) {
      throw unauthorized('Refresh token rotated concurrently');
    }
    return created;
  });

  return {
    user: excludePassword(storedToken.user),
    accessToken,
    refreshToken: newToken.token,
  };
}

export async function logout(refreshTokenStr: string) {
  await prisma.refreshToken.deleteMany({
    where: { token: refreshTokenStr },
  });
}
