import { Router } from 'express';
import { z } from 'zod';
import { asyncWrapper, createRateLimiter, validateBody } from '../../lib/http.js';
import { requireAuth, requireCsrf } from '../auth/auth.middleware.js';
import {
  acceptExistingOrganisationInvitation,
  acceptOrganisationInvitation,
  createOrganisationInvitation,
  revokeOrganisationInvitation,
} from './invitations.controller.js';
import { acceptInvitationSchema, createInvitationSchema } from './invitations.validator.js';

export const invitationsRouter = Router();\ninvitationsRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
invitationsRouter.post(
  '/invitations/accept-existing',
  requireAuth,
  requireCsrf,
  validateBody(z.object({ token: z.string().min(32).max(256) }).strict()),
  asyncWrapper(acceptExistingOrganisationInvitation),
);
invitationsRouter.post(
  '/invitations/accept',
  createRateLimiter(5),
  validateBody(acceptInvitationSchema),
  asyncWrapper(acceptOrganisationInvitation),
);
invitationsRouter.post(
  '/organisations/:organisationId/invitations',
  requireAuth,
  requireCsrf,
  validateBody(createInvitationSchema),
  asyncWrapper(createOrganisationInvitation),
);
invitationsRouter.post(
  '/organisations/:organisationId/invitations/:invitationId/revoke',
  requireAuth,
  requireCsrf,
  asyncWrapper(revokeOrganisationInvitation),
);
