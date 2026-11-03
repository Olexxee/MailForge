import { Router } from 'express';
import { asyncWrapper, createRateLimiter, validateBody } from '../../app.js';
import { requireAuth, requireCsrf } from '../auth/auth.middleware.js';
import { acceptOrganisationInvitation, createOrganisationInvitation, revokeOrganisationInvitation } from './invitations.controller.js';
import { acceptInvitationSchema, createInvitationSchema } from './invitations.validator.js';

export const invitationsRouter = Router();
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
