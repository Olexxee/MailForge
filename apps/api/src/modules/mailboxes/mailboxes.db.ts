import { prisma } from '../../lib/prisma.js';

export const findVerifiedDomain = (organisationId: string, domainId: string) =>
  prisma.domain.findFirst({ where: { id: domainId, organisationId, status: 'VERIFIED' } });

export const findMailboxByEmail = (organisationId: string, email: string) =>
  prisma.mailbox.findUnique({ where: { organisationId_email: { organisationId, email } } });

export const createMailboxConnectionTransaction = (input: {
  organisationId: string;
  domainId: string;
  email: string;
  displayName?: string;
  encryptedCredentials: string;
  credentialKeyVersion: number;
  actorId: string;
}) => prisma.$transaction(async (tx) => {
  const connection = await tx.providerConnection.create({
    data: {
      organisationId: input.organisationId,
      providerType: 'GO54',
      authType: 'PASSWORD',
      accountEmail: input.email,
      encryptedCredentials: input.encryptedCredentials,
      credentialKeyVersion: input.credentialKeyVersion,
    },
  });
  const mailbox = await tx.mailbox.create({
    data: {
      organisationId: input.organisationId,
      domainId: input.domainId,
      providerConnectionId: connection.id,
      email: input.email,
      ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    },
  });
  await tx.mailboxAccess.create({
    data: {
      organisationId: input.organisationId,
      mailboxId: mailbox.id,
      userId: input.actorId,
      permission: 'ADMINISTER',
      grantedById: input.actorId,
    },
  });
  await tx.auditLog.create({
    data: {
      organisationId: input.organisationId,
      actorId: input.actorId,
      action: 'MAILBOX_CONNECTED',
      resourceType: 'Mailbox',
      resourceId: mailbox.id,
      metadata: { email: mailbox.email, provider: 'GO54' },
    },
  });
  return {
    mailbox,
    connection: {
      id: connection.id,
      providerType: connection.providerType,
      accountEmail: connection.accountEmail,
      imapStatus: connection.imapStatus,
      smtpStatus: connection.smtpStatus,
    },
  };
});

export const listMailboxesForUser = (organisationId: string, userId: string) =>
  prisma.mailbox.findMany({
    where: {
      organisationId,
      status: 'ACTIVE',
      accessGrants: { some: { userId, revokedAt: null } },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      status: true,
      domain: { select: { name: true, status: true } },
      providerConnection: {
        select: { id: true, providerType: true, imapStatus: true, smtpStatus: true, lastCheckedAt: true },
      },
      accessGrants: {
        where: { userId, revokedAt: null },
        select: { permission: true },
      },
    },
    orderBy: { email: 'asc' },
  });

export const findMailboxInOrganisation = (organisationId: string, mailboxId: string) =>
  prisma.mailbox.findFirst({
    where: { id: mailboxId, organisationId, status: 'ACTIVE' },
    select: { id: true, email: true, status: true },
  });

export const findMailboxGrant = (organisationId: string, mailboxId: string, userId: string) =>
  prisma.mailboxAccess.findUnique({
    where: { mailboxId_userId: { mailboxId, userId } },
  }).then((grant) => grant?.organisationId === organisationId ? grant : null);

export const listMailboxGrants = (organisationId: string, mailboxId: string) =>
  prisma.mailboxAccess.findMany({
    where: { organisationId, mailboxId, revokedAt: null },
    select: {
      id: true,
      permission: true,
      createdAt: true,
      user: { select: { id: true, email: true, displayName: true, isActive: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

export const findActiveMembership = (organisationId: string, userId: string) =>
  prisma.organizationMembership.findFirst({
    where: { organisationId, userId, isActive: true, user: { isActive: true } },
    select: { id: true },
  });

export const upsertMailboxGrant = (input: {
  organisationId: string;
  mailboxId: string;
  userId: string;
  permission: 'READ' | 'SEND' | 'MANAGE' | 'ADMINISTER';
  grantedById: string;
}) => prisma.$transaction(async (tx) => {
  const grant = await tx.mailboxAccess.upsert({
    where: { mailboxId_userId: { mailboxId: input.mailboxId, userId: input.userId } },
    create: {
      organisationId: input.organisationId,
      mailboxId: input.mailboxId,
      userId: input.userId,
      permission: input.permission,
      grantedById: input.grantedById,
    },
    update: { permission: input.permission, grantedById: input.grantedById, revokedAt: null },
    select: { id: true, permission: true, createdAt: true, user: { select: { id: true, email: true, displayName: true } } },
  });
  await tx.auditLog.create({
    data: {
      organisationId: input.organisationId,
      actorId: input.grantedById,
      action: 'MAILBOX_ACCESS_GRANTED',
      resourceType: 'MailboxAccess',
      resourceId: grant.id,
      metadata: { mailboxId: input.mailboxId, targetUserId: input.userId, permission: input.permission },
    },
  });
  return grant;
});

export const revokeMailboxGrant = (input: {
  organisationId: string;
  mailboxId: string;
  userId: string;
  actorId: string;
}) => prisma.$transaction(async (tx) => {
  const result = await tx.mailboxAccess.updateMany({
    where: { organisationId: input.organisationId, mailboxId: input.mailboxId, userId: input.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 1) {
    await tx.auditLog.create({
      data: {
        organisationId: input.organisationId,
        actorId: input.actorId,
        action: 'MAILBOX_ACCESS_REVOKED',
        resourceType: 'MailboxAccess',
        metadata: { mailboxId: input.mailboxId, targetUserId: input.userId },
      },
    });
  }
  return result.count;
});

export const revokeMailboxGrant = (input: {
  organisationId: string;
  mailboxId: string;
  userId: string;
  actorId: string;
}) => prisma.$transaction(async (tx) => {
  const grant = await tx.mailboxAccess.findUnique({
    where: { mailboxId_userId: { mailboxId: input.mailboxId, userId: input.userId } },
  });
  if (!grant || grant.organisationId !== input.organisationId || grant.revokedAt) return 0;

  if (grant.permission === 'ADMINISTER') {
    const remainingAdministrators = await tx.mailboxAccess.count({
      where: {
        organisationId: input.organisationId,
        mailboxId: input.mailboxId,
        userId: { not: input.userId },
        permission: 'ADMINISTER',
        revokedAt: null,
        user: { isActive: true, memberships: { some: { organisationId: input.organisationId, isActive: true } } },
      },
    });
    if (remainingAdministrators === 0) return -1;
  }

  const result = await tx.mailboxAccess.updateMany({
    where: { organisationId: input.organisationId, mailboxId: input.mailboxId, userId: input.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 1) {
    await tx.auditLog.create({
      data: {
        organisationId: input.organisationId,
        actorId: input.actorId,
        action: 'MAILBOX_ACCESS_REVOKED',
        resourceType: 'MailboxAccess',
        resourceId: grant.id,
        metadata: { mailboxId: input.mailboxId, targetUserId: input.userId },
      },
    });
  }
  return result.count;
}, { isolationLevel: 'Serializable' });
