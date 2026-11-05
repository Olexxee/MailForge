import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { ZodType } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const asyncWrapper = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const createRateLimiter = (limit: number): RequestHandler =>
  rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false });

export const validateBody = (schema: ZodType): RequestHandler => (req, _res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  req.body = parsed.data;
  next();
};

export const validateQuery = (schema: ZodType): RequestHandler => (req, res, next) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  res.locals.validatedQuery = parsed.data;
  next();
};

export const validateParams = (schema: ZodType): RequestHandler => (req, _res, next) => {
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  req.params = parsed.data as typeof req.params;
  next();
};
