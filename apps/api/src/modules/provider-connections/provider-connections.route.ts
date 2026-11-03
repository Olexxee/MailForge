import { Router } from 'express';
import { asyncWrapper, createRateLimiter } from '../../lib/http.js';
import { requireAuth, requireCsrf } from '../auth/auth.middleware.js';
import { validateConnection } from './provider-connections.controller.js';

export const providerConnectionsRouter = Router();
providerConnectionsRouter.use(requireAuth);
providerConnectionsRouter.post(
  '/organisations/:organisationId/provider-connections/:connectionId/validate',
  requireCsrf,
  createRateLimiter(5),
  asyncWrapper(validateConnection),
);
