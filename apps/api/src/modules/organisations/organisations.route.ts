import { Router } from 'express';
import { asyncWrapper } from '../../app.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { listMyOrganisations, listOrganisationMembers } from './organisations.controller.js';

export const organisationsRouter = Router();
organisationsRouter.use(requireAuth);
organisationsRouter.get('/', asyncWrapper(listMyOrganisations));
organisationsRouter.get('/:organisationId/members', asyncWrapper(listOrganisationMembers));
