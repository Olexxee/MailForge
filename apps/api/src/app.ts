import './lib/load-env.js';
import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import helmet from 'helmet';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { ZodError, z } from 'zod';
import { API_PREFIX } from '@mailforge/shared';
import { AppError } from './lib/http.js';
import { authRouter } from './modules/auth/auth.route.js';
import { organisationsRouter } from './modules/organisations/organisations.route.js';
import { invitationsRouter } from './modules/invitations/invitations.route.js';
import { domainsRouter } from './modules/domains/domains.route.js';
import { mailboxesRouter } from './modules/mailboxes/mailboxes.route.js';
import { providerConnectionsRouter } from './modules/provider-connections/provider-connections.route.js';\nimport { messagesRouter } from './modules/messages/messages.route.js';

export { AppError, asyncWrapper, createRateLimiter, validateBody, validateParams, validateQuery } from './lib/http.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export const env = envSchema.parse(process.env);
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.token'],
    censor: '[REDACTED]',
  },
});

const requestContext: RequestHandler = (_req, res, next) => {
  const id = randomUUID();
  res.locals.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};

const notFound: RequestHandler = (req, _res, next) =>
  next(new AppError('ROUTE_NOT_FOUND', 404, `Route ${req.method} ${req.path} was not found`));

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  // Express identifies error middleware by its four-argument function signature.
  void next;
  const requestId = (res.locals.requestId as string | undefined) ?? 'unknown';
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: error.flatten() },
      requestId,
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
      requestId,
    });
    return;
  }
  logger.error(
    { errorName: error instanceof Error ? error.name : 'UnknownError', requestId },
    'Unhandled request error',
  );
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    requestId,
  });
};

export const app = express();
if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(requestContext);
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use(API_PREFIX + '/auth', authRouter);
app.use(API_PREFIX, invitationsRouter);
app.use(API_PREFIX + '/organisations', organisationsRouter);
app.use(API_PREFIX, domainsRouter);
app.use(API_PREFIX, mailboxesRouter);
app.use(API_PREFIX, providerConnectionsRouter);\napp.use(API_PREFIX, messagesRouter);

app.get(API_PREFIX + '/health/live', (_req, res) =>
  res.status(200).json({ success: true, data: { status: 'ok' }, requestId: res.locals.requestId }),
);
app.get(API_PREFIX + '/health/ready', (_req, res) =>
  res.status(200).json({ success: true, data: { status: 'ready' }, requestId: res.locals.requestId }),
);

app.use(notFound);
app.use(errorHandler);
