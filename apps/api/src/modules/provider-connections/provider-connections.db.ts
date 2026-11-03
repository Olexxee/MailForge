import { prisma } from '../../lib/prisma.js';

export const findProviderConnection = (organisationId: string, connectionId: string) =>
  prisma.providerConnection.findFirst({
    where: { id: connectionId, organisationId },
    include: { mailboxes: { select: { id: true, email: true, status: true } } },
  });

export const updateProviderHealth = (input: {
  organisationId: string;
  connectionId: string;
  imapStatus: 'AVAILABLE' | 'UNAVAILABLE';
  smtpStatus: 'AVAILABLE' | 'UNAVAILABLE';
  lastCheckedAt: Date;
  lastSafeErrorCode: string | null;
  actorId: string;
}) => prisma.$transaction(async (tx) => {
  const result = await tx.providerConnection.updateMany({
    where: { id: input.connectionId, organisationId: input.organisationId },
    data: {
      imapStatus: input.imapStatus,
      smtpStatus: input.smtpStatus,
      lastCheckedAt: input.lastCheckedAt,
      lastSafeErrorCode: input.lastSafeErrorCode,
    },
  });
  if (result.count === 1) {
    await tx.auditLog.create({
      data: {
        organisationId: input.organisationId,
        actorId: input.actorId,
        action: 'PROVIDER_CONNECTION_VALIDATED',
        resourceType: 'ProviderConnection',
        resourceId: input.connectionId,
        metadata: { imapStatus: input.imapStatus, smtpStatus: input.smtpStatus },
      },
    });
  }
  return result.count;
});
