import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function isDatabaseUnreachable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  if (
    /Can't reach database|Connection terminated|ECONNREFUSED|ECONNRESET|P1001|P1017|P1002|Engine was empty|ConnectorError|prepared statement|portal does not exist/i.test(
      message,
    )
  ) {
    return true;
  }
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    if (/Engine was empty|ConnectorError|Connection|ECONN|terminated/i.test(err.message)) {
      return true;
    }
  }
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    ['P1001', 'P1002', 'P1017'].includes(err.code)
  ) {
    return true;
  }
  return false;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.flatten(),
    });
    return;
  }

  if (isDatabaseUnreachable(err)) {
    res.status(503).json({
      error: 'Database is offline. Start the dev database and try again.',
      code: 'DATABASE_OFFLINE',
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(401).json({
      error: 'Session expired — please sign in again.',
      code: 'USER_NOT_FOUND',
    });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === 'P2021' || err.code === 'P2022')
  ) {
    const schemaMessage =
      err.code === 'P2022'
        ? 'Database schema is out of date or missing a required column. In apps/api run: npx prisma migrate deploy'
        : 'Database schema is out of date. In apps/api run: npx prisma migrate deploy';

    res.status(503).json({
      error: schemaMessage,
      code: 'SCHEMA_OUT_OF_DATE',
    });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2010' &&
    String(err.meta?.message ?? err.message).includes('prepared statement')
  ) {
    res.status(503).json({
      error:
        'Database connection issue — restart the API (npm run dev:api) and ensure prisma dev is running.',
      code: 'DATABASE_PREPARED_STATEMENT',
    });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientUnknownRequestError &&
    String(err.message).includes('prepared statement')
  ) {
    res.status(503).json({
      error:
        'Database connection issue — restart Prisma dev and the API, then try again.',
      code: 'DATABASE_PREPARED_STATEMENT',
    });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientUnknownRequestError &&
    (String(err.message).includes('portal') || String(err.message).includes('ConnectorError'))
  ) {
    res.status(503).json({
      error:
        'Database connection issue — restart Prisma dev and the API, then try again.',
      code: 'DATABASE_CONNECTION',
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(err);
    res.status(503).json({
      error: 'API needs a Prisma refresh. In apps/api run: npx prisma generate',
      code: 'PRISMA_CLIENT_STALE',
    });
    return;
  }

  console.error(err);
  if (req.path === '/auth/admin/login') {
    res.status(503).json({
      error: 'Staff login service failed. Restart the API and run Prisma generate.',
      code: 'ADMIN_LOGIN_SERVICE_ERROR',
    });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
}

export function notFoundHandler(req: Request, res: Response): void {
  console.warn(`[api] 404 ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Not found', path: req.originalUrl, method: req.method });
}
