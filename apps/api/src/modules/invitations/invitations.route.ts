import { Router } from 'express';
import { asyncWrapper, createRateLimiter, validateBody } from '../../app.js';
import { requireAuth, requireCsrf } from '../auth/auth.middleware.js';
import { acceptExistingOrganisationInvitation, acceptOrganisationInvitation, createOrganisationInvitation, revokeOrganisationInvitation } from './invitations.controller.js';
import { z } from 'zod';\nimport { acceptInvitationSchema, createInvitationSchema } from './invitations.validator.js';

export const invitationsRouter = Router();\ninvitationsRouter.post('/invitations/accept-existing', requireAuth, requireCsrf, validateBody(z.object({ token: z.string().min(32).max(256) }).strict()), asyncWrapper(acceptExistingOrganisationInvitation));
invitationsRouter.post('/invitations/accept', createRateLimiter(5), validateBody(acceptInvitationSchema), asyncWrapper(acceptOrganisationInvitation));
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
