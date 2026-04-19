import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from '../errors.ts';

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((error, _request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.validation,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.flatten(),
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }

    // Respect Fastify-style errors with a `statusCode` (e.g. those thrown by
    // @fastify/rate-limit, @fastify/jwt, or any plugin that follows the
    // convention). Without this, a 429 from rate-limit becomes a misleading
    // 500 — the caller can't distinguish "back off" from "we crashed".
    const errAsObj = error as { statusCode?: unknown; code?: unknown; message?: unknown };
    const status = errAsObj.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 600) {
      return reply.status(status).send({
        error: typeof errAsObj.code === 'string' ? errAsObj.code : 'ERROR',
        message: typeof errAsObj.message === 'string' ? errAsObj.message : 'Request failed',
      });
    }

    app.log.error(error);
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
  });
});
