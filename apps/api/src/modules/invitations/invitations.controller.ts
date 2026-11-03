import type { Request, Response } from 'express';
import { issueSession } from '../auth/auth.service.js';
import { setSessionCookies } from '../auth/auth.controller.js';
import { acceptInvitation, inviteMember } from './invitations.service.js';

export const createOrganisationInvitation = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const body = req.body as { email: string; role: 'ADMIN' | 'STAFF' };
  const invitation = await inviteMember({
    organisationId: req.params.organisationId!,
    actorId: auth.userId,
    email: body.email,
    role: body.role,
  });
  res.status(201).json({
    success: true,
    data: {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      invitationToken: invitation.token,
      delivery: 'MANUAL_SECURE_DISTRIBUTION',
    },
    requestId: res.locals.requestId,
  });
};

export const acceptOrganisationInvitation = async (req: Request, res: Response) => {
  const body = req.body as { token: string; displayName: string; password: string };
  const user = await acceptInvitation(body);
  const session = await issueSession(user.userId);
  setSessionCookies(res, session.sessionToken, session.csrfToken, session.expiresAt);
  res.status(201).json({
    success: true,
    data: { user, csrfToken: session.csrfToken },
    requestId: res.locals.requestId,
  });
};
