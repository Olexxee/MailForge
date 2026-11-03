import { Router } from 'express';
import { asyncWrapper, createRateLimiter, validateBody, validateParams } from '../../lib/http.js';
import { requireAuth, requireCsrf } from '../auth/auth.middleware.js';
import { createDomain, listDomains, rotateDomainChallenge, verifyDomain } from './domains.controller.js';
import { createDomainSchema, domainParamsSchema, organisationDomainParamsSchema } from './domains.validator.js';

export const domainsRouter = Router();
domainsRouter.use(requireAuth);
domainsRouter.get('/organisations/:organisationId/domains', validateParams(organisationDomainParamsSchema), asyncWrapper(listDomains));
domainsRouter.post(
  '/organisations/:organisationId/domains',
  requireCsrf,
  validateParams(organisationDomainParamsSchema),
  createRateLimiter(10),
  validateBody(createDomainSchema),
  asyncWrapper(createDomain),
);
domainsRouter.post(
  '/organisations/:organisationId/domains/:domainId/verify',
  requireCsrf,
  validateParams(domainParamsSchema),
  createRateLimiter(5),
  asyncWrapper(verifyDomain),
);

domainsRouter.post(
  '/organisations/:organisationId/domains/:domainId/verification-challenge',
  requireCsrf,
  validateParams(domainParamsSchema),
  createRateLimiter(5),
  asyncWrapper(rotateDomainChallenge),
);
