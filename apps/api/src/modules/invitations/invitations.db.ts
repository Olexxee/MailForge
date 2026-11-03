import { prisma } from '../../lib/prisma.js';

export const createInvitation = (input: {
  organisationId: string; email: string; role: 'ADMIN' | 'STAFF'; tokenHash: string;
  inviterId: string; expiresAt: Date;
}) => prisma.organizationInvitation.create({ data: input });

export const findInvitationByTokenHash = (tokenHash: string) =>
  prisma.organizationInvitation.findUnique({ where: { tokenHash } });

export const revokeInvitation = (organisationId: string, invitationId: string) =>
  prisma.organizationInvitation.updateMany({
    where: { id: invitationId, organisationId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

export const acceptInvitationTransaction = async (input: {
  invitationId: string; email: string; displayName: string; passwordHash: string;
}) => prisma.$transaction(async (tx) => {
  const invitation = await tx.organizationInvitation.findFirst({
    where: { id: input.invitationId, email: input.email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!invitation) return null;
  const existing = await tx.user.findUnique({ where: { email: input.email } });
  if (existing) return { existingUser: true as const };
  const user = await tx.user.create({
    data: { email: input.email, displayName: input.displayName, passwordHash: input.passwordHash },
  });
  const claimed = await tx.organizationInvitation.updateMany({
    where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { acceptedAt: new Date() },
  });
  if (claimed.count !== 1) throw new Error('Invitation was already claimed');
  const membership = await tx.organizationMembership.create({
    data: { organisationId: invitation.organisationId, userId: user.id, role: invitation.role },
  });
  await tx.auditLog.create({
    data: {
      organisationId: invitation.organisationId,
      actorId: user.id,
      action: 'INVITATION_ACCEPTED',
      resourceType: 'OrganizationInvitation',
      resourceId: invitation.id,
      metadata: { role: invitation.role },
    },
  });
  return { existingUser: false as const, user, membership };
});
