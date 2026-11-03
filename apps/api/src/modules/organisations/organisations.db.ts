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
