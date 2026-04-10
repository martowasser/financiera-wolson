import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = 'Resource not found') {
  return new AppError(404, 'NOT_FOUND', message);
}

export function unauthorized(message = 'Unauthorized') {
  return new AppError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'Forbidden') {
  return new AppError(403, 'FORBIDDEN', message);
}

export function badRequest(message = 'Bad request', details?: unknown) {
  return new AppError(400, 'BAD_REQUEST', message, details);
}

export function conflict(message = 'Conflict', code = 'CONFLICT', details?: unknown) {
  return new AppError(409, code, message, details);
}

export function unprocessable(message = 'Unprocessable entity', codeOrDetails?: string | unknown, details?: unknown) {
  if (typeof codeOrDetails === 'string') {
    return new AppError(422, codeOrDetails, message, details);
  }
  return new AppError(422, 'UNPROCESSABLE_ENTITY', message, codeOrDetails);
}

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  request.log.error(error);

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  // Zod validation errors
  if (error.name === 'ZodError') {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: (error as any).issues,
      },
    });
  }

  // Fastify validation errors
  if ('validation' in error && (error as FastifyError).validation) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
      },
    });
  }

  // Rate limit errors
  if ((error as FastifyError).statusCode === 429) {
    return reply.status(429).send({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    });
  }

  // Default 500
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message,
    },
  });
}
