import { AppError } from '../../lib/http.js';
import { createOpaqueToken, hashPassword, hashToken } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';
import { assertOrganisationRole } from '../organisations/organisations.service.js';
import { acceptInvitationTransaction, createInvitation, findInvitationByTokenHash, listPendingInvitations, revokeInvitation } from './invitations.db.js';

export const inviteMember = async (input: {
  organisationId: string; actorId: string; email: string; role: 'ADMIN' | 'STAFF';
}) => {
  const actor = await assertOrganisationRole(input.organisationId, input.actorId, ['OWNER', 'ADMIN']);
  if (actor.role === 'ADMIN' && input.role !== 'STAFF') {
    throw new AppError('ACCESS_DENIED', 403, 'Administrators may invite staff members only');
  }
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    const membership = await prisma.organizationMembership.findUnique({
      where: { organisationId_userId: { organisationId: input.organisationId, userId: existing.id } },
    });
    if (membership?.isActive) throw new AppError('ALREADY_A_MEMBER', 409, 'This user is already a member');
  }

  const token = createOpaqueToken(32);
  const invitation = await createInvitation({
    organisationId: input.organisationId,
    email: input.email,
    role: input.role,
    tokenHash: hashToken(token),
    inviterId: input.actorId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
    throw new AppError('ACCOUNT_EXISTS', 409, 'An account already exists; sign in and accept the invitation using the authenticated invitation endpoint');
  }
  return { userId: result.user.id, email: result.user.email, displayName: result.user.displayName };
};

export const acceptInvitationForExistingUser = async (input: {
  token: string; userId: string; email: string;
}) => {
  const invitation = await findInvitationByTokenHash(hashToken(input.token));
  if (!invitation || invitation.email !== input.email || invitation.acceptedAt ||
      invitation.revokedAt || invitation.expiresAt <= new Date()) {
    throw new AppError('INVITATION_INVALID', 400, 'Invitation is invalid or has expired');
  }
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.organizationInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count !== 1) throw new AppError('INVITATION_INVALID', 400, 'Invitation is invalid or has expired');
    await tx.organizationMembership.upsert({
      where: { organisationId_userId: { organisationId: invitation.organisationId, userId: input.userId } },
      create: { organisationId: invitation.organisationId, userId: input.userId, role: invitation.role },
      update: { role: invitation.role, isActive: true },
    });
    await tx.auditLog.create({
      data: {
        organisationId: invitation.organisationId,
        actorId: input.userId,
        action: 'INVITATION_ACCEPTED',
        resourceType: 'OrganizationInvitation',
        resourceId: invitation.id,
        metadata: { role: invitation.role },
      },
    });
  });
};

export const revokeOrganisationInvitation = async (input: {
  organisationId: string; invitationId: string; actorId: string;
}) => {
  await assertOrganisationRole(input.organisationId, input.actorId, ['OWNER', 'ADMIN']);
  const result = await revokeInvitation(input);
  if (result.count !== 1) throw new AppError('INVITATION_NOT_FOUND', 404, 'Pending invitation was not found');
};

export const getPendingInvitations = async (organisationId: string, actorId: string) => {
  await assertOrganisationRole(organisationId, actorId, ['OWNER', 'ADMIN']);
  return listPendingInvitations(organisationId);
};
