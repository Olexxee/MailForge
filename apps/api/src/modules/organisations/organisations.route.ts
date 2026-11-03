import { Router } from 'express';
import { asyncWrapper, validateBody } from '../../app.js';
import { requireAuth, requireCsrf } from '../auth/auth.middleware.js';
import { listMyOrganisations, listOrganisationMembers, updateOrganisationMember } from './organisations.controller.js';
import { updateMembershipSchema } from './organisations.validator.js';

export const organisationsRouter = Router();
organisationsRouter.use(requireAuth);
organisationsRouter.get('/', asyncWrapper(listMyOrganisations));
organisationsRouter.get('/:organisationId/members', asyncWrapper(listOrganisationMembers));
organisationsRouter.patch(
  '/:organisationId/members/:userId',
  requireCsrf,
  validateBody(updateMembershipSchema),
  asyncWrapper(updateOrganisationMember),
);
