import { prisma } from '../../lib/prisma.js';

export const createDomainRecord = (input: {
  organisationId: string;
  name: string;
  verificationToken: string;
  createdById: string;
}) => prisma.$transaction(async (tx) => {
  const domain = await tx.domain.create({ data: input });
  await tx.auditLog.create({
    data: {
      organisationId: input.organisationId,
      actorId: input.createdById,
      action: 'DOMAIN_ADDED',
      resourceType: 'Domain',
      resourceId: domain.id,
      metadata: { domain: domain.name },
    },
  });
  return domain;
});

export const listDomainRecords = (organisationId: string) =>
  prisma.domain.findMany({
    where: { organisationId },
    select: { id: true, name: true, status: true, verifiedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

export const findDomainRecord = (organisationId: string, domainId: string) =>
  prisma.domain.findFirst({ where: { id: domainId, organisationId } });

export const markDomainRecordVerified = (input: {
  organisationId: string;
  domainId: string;
  actorId: string;
  expectedToken: string;
}) => prisma.$transaction(async (tx) => {
  const result = await tx.domain.updateMany({
    where: { id: input.domainId, organisationId: input.organisationId, status: 'PENDING', verificationToken: input.expectedToken },
    data: { status: 'VERIFIED', verifiedAt: new Date() },
  });
  if (result.count === 1) {
    await tx.auditLog.create({
      data: {
        organisationId: input.organisationId,
        actorId: input.actorId,
        action: 'DOMAIN_VERIFIED',
        resourceType: 'Domain',
        resourceId: input.domainId,
      },
    });
  }
  return result.count;
});

export const rotateDomainVerificationToken = (input: {
  organisationId: string;
  domainId: string;
  actorId: string;
  verificationToken: string;
}) => prisma.$transaction(async (tx) => {
  const result = await tx.domain.updateMany({
    where: { id: input.domainId, organisationId: input.organisationId, status: 'PENDING' },
    data: { verificationToken: input.verificationToken },
  });
  if (result.count === 1) {
    await tx.auditLog.create({
      data: {
        organisationId: input.organisationId,
        actorId: input.actorId,
        action: 'DOMAIN_VERIFICATION_CHALLENGE_ROTATED',
        resourceType: 'Domain',
        resourceId: input.domainId,
      },
    });
  }
  return result.count;
});
