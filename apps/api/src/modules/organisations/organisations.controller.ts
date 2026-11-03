import type { Request, Response } from 'express';
import { getMyOrganisations, getOrganisationMembers } from './organisations.service.js';

export const listMyOrganisations = async (_req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const organisations = await getMyOrganisations(auth.userId);
  res.json({ success: true, data: { organisations }, requestId: res.locals.requestId });
};

export const listOrganisationMembers = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const members = await getOrganisationMembers(req.params.organisationId!, auth.userId);
  res.json({ success: true, data: { members }, requestId: res.locals.requestId });
};
