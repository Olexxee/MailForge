import { prisma } from '../../lib/prisma.js';

export const findMembershipsForUser = (userId: string) =>
  prisma.organizationMembership.findMany({
    where: { userId, isActive: true },
    include: { organisation: true },
    orderBy: { createdAt: 'asc' },
  });

export const findMembership = (organisationId: string, userId: string) =>
  prisma.organizationMembership.findUnique({
    where: { organisationId_userId: { organisationId, userId } },
    include: { organisation: true },
  });

export const listMembers = (organisationId: string) =>
  prisma.organizationMembership.findMany({
    where: { organisationId },
    include: { user: { select: { id: true, email: true, displayName: true } } },
    orderBy: { createdAt: 'asc' },
  });

export const updateMembership = async (input: {
  organisationId: string; userId: string; role?: 'ADMIN' | 'STAFF'; isActive?: boolean;
  actorId: string;
}) => prisma.$transaction(async (tx) => {
  const target = await tx.organizationMembership.findUnique({
    where: { organisationId_userId: { organisationId: input.organisationId, userId: input.userId } },
  });
  if (!target) return null;

  if (input.isActive === false && target.isActive) {
    const administeredMailboxes = await tx.mailboxAccess.findMany({
      where: {
        organisationId: input.organisationId,
        userId: input.userId,
        permission: 'ADMINISTER',
        revokedAt: null,
      },
      select: { mailboxId: true },
    });
    for (const grant of administeredMailboxes) {
      const otherAdministrators = await tx.mailboxAccess.count({
        where: {
          organisationId: input.organisationId,
          mailboxId: grant.mailboxId,
          userId: { not: input.userId },
          permission: 'ADMINISTER',
          revokedAt: null,
          membership: { isActive: true, user: { isActive: true } },
        },
      });
      if (otherAdministrators === 0) throw new Error('LAST_MAILBOX_ADMIN');
    }
  }

  const updated = await tx.organizationMembership.update({
    where: { id: target.id },
    data: {
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });

  if (input.isActive === false && target.isActive) {
    await tx.mailboxAccess.updateMany({
      where: { organisationId: input.organisationId, userId: input.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await tx.auditLog.create({
    data: {
      organisationId: input.organisationId,
      actorId: input.actorId,
      action: 'MEMBERSHIP_UPDATED',
      resourceType: 'OrganizationMembership',
      resourceId: target.id,
      metadata: {
        targetUserId: input.userId,
        ...(input.role === undefined ? {} : { role: input.role }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        ...(input.isActive === false && target.isActive ? { mailboxGrantsRevoked: true } : {}),
      },
    },
  });
  return updated;
}, { isolationLevel: 'Serializable' });
