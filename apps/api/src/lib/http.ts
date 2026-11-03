import type { RequestHandler } from 'express';
import { z, ZodError } from 'zod';

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
  (awaitRateLimit(limit));

function awaitRateLimit(limit: number): RequestHandler {
  // Kept in this shared module so feature routers never import the app entry point.
  return rateLimitFactory(limit);
}

import { rateLimit as rateLimitFactory } from 'express-rate-limit';

export const validateBody = (schema: z.ZodType): RequestHandler => (req, _res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  req.body = parsed.data;
  next();
};

export const isValidationError = (error: unknown): error is ZodError => error instanceof ZodError;
