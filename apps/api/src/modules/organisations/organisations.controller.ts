import type { Request, Response } from 'express';
import { changeOrganisationMembership, getMyOrganisations, getOrganisationMembers } from './organisations.service.js';

export const listMyOrganisations = async (_req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const organisations = await getMyOrganisations(auth.userId);
  res.json({ success: true, data: { organisations }, requestId: res.locals.requestId });
};

export const listOrganisationMembers = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const members = await getOrganisationMembers(req.params.organisationId as string, auth.userId);
  res.json({ success: true, data: { members }, requestId: res.locals.requestId });
};

export const updateOrganisationMember = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const body = req.body as { role?: 'ADMIN' | 'STAFF'; isActive?: boolean };
  const membership = await changeOrganisationMembership({
    organisationId: req.params.organisationId!,
    actorId: auth.userId,
    targetUserId: req.params.userId as string,
    ...body,
  });
  res.json({
    success: true,
    data: { membership: {
      id: membership.id,
      user: membership.user,
      role: membership.role,
      isActive: membership.isActive,
    } },
    requestId: res.locals.requestId,
  });
};
