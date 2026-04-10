import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as authService from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /login — rate limited to 5 per minute
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body.email, body.password);
    return result;
  });

  // POST /register — requires ADMIN role
  fastify.post('/register', {
    preHandler: [requireRole('ADMIN')],
  }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const user = await authService.register(body.email, body.password, body.name, body.role);
    return reply.status(201).send(user);
  });

  // POST /refresh — no auth required
  fastify.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const tokens = await authService.refresh(body.refreshToken);
    return tokens;
  });

  // POST /logout — no auth required
  fastify.post('/logout', async (request, reply) => {
    const body = logoutSchema.parse(request.body);
    await authService.logout(body.refreshToken);
    return { message: 'Logged out successfully' };
  });
}
