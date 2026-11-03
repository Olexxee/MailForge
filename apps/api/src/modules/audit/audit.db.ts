import { Prisma } from '@prisma/client';\nimport { prisma } from '../../lib/prisma.js';

export const writeAuditEvent = (input: {
  organisationId: string; actorId?: string; action: string; resourceType: string;
  resourceId?: string; metadata?: Record<string, unknown>;
}) => prisma.auditLog.create({
  data: {
    organisationId: input.organisationId,
    ...(input.actorId ? { actorId: input.actorId } : {}),
    action: input.action,
    resourceType: input.resourceType,
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
    ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonObject } : {}),
  },
});
