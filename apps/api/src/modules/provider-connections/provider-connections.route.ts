import { Router } from 'express';
import { asyncWrapper, createRateLimiter, validateParams } from '../../lib/http.js';
import { requireAuth, requireCsrf } from '../auth/auth.middleware.js';
import { validateConnection } from './provider-connections.controller.js';
import { validateProviderConnectionParamsSchema } from './provider-connections.validator.js';

export const providerConnectionsRouter = Router();
providerConnectionsRouter.use(requireAuth);
providerConnectionsRouter.post(
  '/organisations/:organisationId/provider-connections/:connectionId/validate',
  requireCsrf,
  validateParams(validateProviderConnectionParamsSchema),
  createRateLimiter(5),
  asyncWrapper(validateConnection),
);
