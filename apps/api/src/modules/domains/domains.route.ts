import { Router } from 'express';
import { asyncWrapper, createRateLimiter, validateBody } from '../../lib/http.js';
import { requireAuth, requireCsrf } from '../auth/auth.middleware.js';
import { createDomain, listDomains, verifyDomain } from './domains.controller.js';
import { createDomainSchema } from './domains.validator.js';

export const domainsRouter = Router();
domainsRouter.use(requireAuth);
domainsRouter.get('/organisations/:organisationId/domains', asyncWrapper(listDomains));
domainsRouter.post(
  '/organisations/:organisationId/domains',
  requireCsrf,
  createRateLimiter(10),
  validateBody(createDomainSchema),
  asyncWrapper(createDomain),
);
domainsRouter.post(
  '/organisations/:organisationId/domains/:domainId/verify',
  requireCsrf,
  createRateLimiter(5),
  asyncWrapper(verifyDomain),
);
