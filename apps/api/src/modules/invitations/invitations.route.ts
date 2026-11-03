import { Router } from 'express';
import { asyncWrapper, createRateLimiter, validateBody } from '../../app.js';
import { requireAuth, requireCsrf } from '../auth/auth.middleware.js';
import { acceptOrganisationInvitation, createOrganisationInvitation } from './invitations.controller.js';
import { acceptInvitationSchema, createInvitationSchema } from './invitations.validator.js';

export const invitationsRouter = Router();
invitationsRouter.post('/accept', createRateLimiter(5), validateBody(acceptInvitationSchema), asyncWrapper(acceptOrganisationInvitation));
invitationsRouter.post(
  '/organisations/:organisationId/invitations',
  requireAuth,
  requireCsrf,
  validateBody(createInvitationSchema),
  asyncWrapper(createOrganisationInvitation),
);
