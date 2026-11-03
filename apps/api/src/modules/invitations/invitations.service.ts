import { AppError } from '../../app.js';
import { createOpaqueToken, hashPassword, hashToken } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';
import { assertOrganisationRole } from '../organisations/organisations.service.js';
import { acceptInvitationTransaction, createInvitation, findInvitationByTokenHash, revokeInvitation } from './invitations.db.js';

export const inviteMember = async (input: {
  organisationId: string; actorId: string; email: string; role: 'ADMIN' | 'STAFF';
}) => {
  const actor = await assertOrganisationRole(input.organisationId, input.actorId, ['OWNER', 'ADMIN']);
  if (actor.role === 'ADMIN' && input.role !== 'STAFF') {
    throw new AppError('ACCESS_DENIED', 403, 'Administrators may invite staff members only');
  }
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError('ACCOUNT_EXISTS', 409, 'This email already has a MailForge account; existing-account invitations are not enabled yet');

  const token = createOpaqueToken(32);
  const invitation = await createInvitation({
    organisationId: input.organisationId,
    email: input.email,
    role: input.role,
    tokenHash: hashToken(token),
    inviterId: input.actorId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await prisma.auditLog.create({
    data: {
      organisationId: input.organisationId,
      actorId: input.actorId,
      action: 'INVITATION_CREATED',
      resourceType: 'OrganizationInvitation',
      resourceId: invitation.id,
      metadata: { email: input.email, role: input.role },
    },
  });
  // Return the raw token once; only its SHA-256 digest is persisted.
  return { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, token };
};

export const acceptInvitation = async (input: {
  token: string; displayName: string; password: string;
}) => {
  const invitation = await findInvitationByTokenHash(hashToken(input.token));
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) {
    throw new AppError('INVITATION_INVALID', 400, 'Invitation is invalid or has expired');
  }
  const passwordHash = await hashPassword(input.password);
  const result = await acceptInvitationTransaction({
    invitationId: invitation.id,
    email: invitation.email,
    displayName: input.displayName,
    passwordHash,
  });
  if (!result) throw new AppError('INVITATION_INVALID', 400, 'Invitation is invalid or has expired');
  if (result.existingUser) {
    throw new AppError('ACCOUNT_EXISTS', 409, 'An account already exists for this email; sign in and ask an organisation admin to grant access');
  }
  return { userId: result.user.id, email: result.user.email, displayName: result.user.displayName };
};

export const revokeOrganisationInvitation = async (input: {
  organisationId: string; invitationId: string; actorId: string;
}) => {
  await assertOrganisationRole(input.organisationId, input.actorId, ['OWNER', 'ADMIN']);
  const result = await revokeInvitation(input.organisationId, input.invitationId);
  if (result.count !== 1) throw new AppError('INVITATION_NOT_FOUND', 404, 'Pending invitation was not found');
  await prisma.auditLog.create({
    data: {
      organisationId: input.organisationId,
      actorId: input.actorId,
      action: 'INVITATION_REVOKED',
      resourceType: 'OrganizationInvitation',
      resourceId: input.invitationId,
    },
  });
};
