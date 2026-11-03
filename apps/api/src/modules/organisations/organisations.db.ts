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
    where: { organisationId, isActive: true },
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
  const updated = await tx.organizationMembership.update({
    where: { id: target.id },
    data: {
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });
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
      },
    },
  });
  return updated;
});
