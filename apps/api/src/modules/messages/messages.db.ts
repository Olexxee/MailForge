import { prisma } from '../../lib/prisma.js';

export const findMailboxProviderForRead = (organisationId: string, mailboxId: string) =>
  prisma.mailbox.findFirst({
    where: { id: mailboxId, organisationId, status: 'ACTIVE' },
    select: {
      id: true,
      email: true,
      providerConnection: {
        select: {
          providerType: true,
          accountEmail: true,
          encryptedCredentials: true,
          credentialKeyVersion: true,
          imapStatus: true,
        },
      },
    },
  });
