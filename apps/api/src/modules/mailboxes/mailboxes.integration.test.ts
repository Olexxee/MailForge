import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { decryptCredential } from '../../lib/credential-encryption.js';
import {
  assertMailboxPermission,
  connectGo54Mailbox,
  grantMailboxAccess,
  revokeMailboxAccess,
} from './mailboxes.service.js';
import { changeOrganisationMembership } from '../organisations/organisations.service.js';

const suffix = randomUUID();
const key = Buffer.alloc(32, 7).toString('base64');
const previousKeys = process.env.CREDENTIAL_ENCRYPTION_KEYS_JSON;
const previousVersion = process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION;
const userIds: string[] = [];
const organisationIds: string[] = [];
let ownerId = '';
let staffId = '';
let outsiderId = '';
let organisationId = '';
let otherOrganisationId = '';
let mailboxId = '';
let connectionId = '';

describe('Phase 2 domains, GO54 connections, and mailbox access', () => {
  beforeAll(async () => {
    process.env.CREDENTIAL_ENCRYPTION_KEYS_JSON = JSON.stringify({ 1: key });
    process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION = '1';
    const [owner, staff, outsider] = await Promise.all([
      prisma.user.create({ data: { email: `p2-owner-${suffix}@mailforge.test`, displayName: 'P2 Owner', passwordHash: 'test-hash' } }),
      prisma.user.create({ data: { email: `p2-staff-${suffix}@mailforge.test`, displayName: 'P2 Staff', passwordHash: 'test-hash' } }),
      prisma.user.create({ data: { email: `p2-outsider-${suffix}@mailforge.test`, displayName: 'P2 Outsider', passwordHash: 'test-hash' } }),
    ]);
    userIds.push(owner.id, staff.id, outsider.id);
    ownerId = owner.id;
    staffId = staff.id;
    outsiderId = outsider.id;

    const [organisation, otherOrganisation] = await Promise.all([
      prisma.organisation.create({ data: { name: 'P2 Integration', slug: `p2-${suffix}` } }),
      prisma.organisation.create({ data: { name: 'P2 Other Integration', slug: `p2-other-${suffix}` } }),
    ]);
    organisationIds.push(organisation.id, otherOrganisation.id);
    organisationId = organisation.id;
    otherOrganisationId = otherOrganisation.id;

    await prisma.organizationMembership.createMany({
      data: [
        { organisationId, userId: ownerId, role: 'OWNER' },
        { organisationId, userId: staffId, role: 'STAFF' },
        { organisationId: otherOrganisationId, userId: outsiderId, role: 'OWNER' },
      ],
    });

    const domain = await prisma.domain.create({
      data: {
        organisationId,
        name: `p2-${suffix}.test`,
        verificationToken: 'public-test-challenge',
        status: 'VERIFIED',
        verifiedAt: new Date(),
        createdById: ownerId,
      },
    });
    const result = await connectGo54Mailbox({
      organisationId,
      actorId: ownerId,
      domainId: domain.id,
      email: `admin@p2-${suffix}.test`,
      displayName: 'Test Admin Mailbox',
      password: 'provider-secret-that-must-not-be-stored-plaintext',
    });
    mailboxId = result.mailbox.id;
    connectionId = result.connection.id;
  });

  afterAll(async () => {
    try {
      await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      if (previousKeys === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEYS_JSON;
      else process.env.CREDENTIAL_ENCRYPTION_KEYS_JSON = previousKeys;
      if (previousVersion === undefined) delete process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION;
      else process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION = previousVersion;
      await prisma.$disconnect();
    }
  });

  it('stores provider credentials as authenticated ciphertext and gives the creator explicit ADMINISTER access', async () => {
    const connection = await prisma.providerConnection.findUnique({ where: { id: connectionId } });
    expect(connection).not.toBeNull();
    expect(connection!.encryptedCredentials).not.toContain('provider-secret-that-must-not-be-stored-plaintext');
    expect(JSON.parse(decryptCredential(connection!.encryptedCredentials, connection!.credentialKeyVersion)))
      .toEqual({ password: 'provider-secret-that-must-not-be-stored-plaintext' });
    await expect(assertMailboxPermission(organisationId, mailboxId, ownerId, 'ADMINISTER')).resolves.toBeTruthy();
  });

  it('enforces same-organisation foreign keys for mailbox domains and access grants', async () => {
    const foreignDomain = await prisma.domain.create({
      data: {
        organisationId: otherOrganisationId,
        name: `foreign-${suffix}.test`,
        verificationToken: 'foreign-public-challenge',
        status: 'VERIFIED',
        verifiedAt: new Date(),
        createdById: outsiderId,
      },
    });
    await expect(prisma.mailbox.create({
      data: {
        organisationId,
        domainId: foreignDomain.id,
        providerConnectionId: connectionId,
        email: `foreign@${foreignDomain.name}`,
      },
    })).rejects.toMatchObject({ code: 'P2003' });

    await expect(prisma.mailboxAccess.create({
      data: {
        organisationId,
        mailboxId,
        userId: outsiderId,
        permission: 'READ',
        grantedById: ownerId,
      },
    })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('denies organisation members without a mailbox grant and prevents cross-organisation access', async () => {
    await expect(assertMailboxPermission(organisationId, mailboxId, staffId, 'READ'))
      .rejects.toMatchObject({ code: 'MAILBOX_ACCESS_DENIED', statusCode: 403 });
    await expect(assertMailboxPermission(organisationId, mailboxId, outsiderId, 'READ'))
      .rejects.toMatchObject({ code: 'ACCESS_DENIED', statusCode: 403 });
  });

  it('enforces permission levels and revokes explicit grants', async () => {
    await grantMailboxAccess({ organisationId, mailboxId, actorId: ownerId, userId: staffId, permission: 'READ' });
    await expect(assertMailboxPermission(organisationId, mailboxId, staffId, 'READ')).resolves.toBeTruthy();
    await expect(assertMailboxPermission(organisationId, mailboxId, staffId, 'SEND'))
      .rejects.toMatchObject({ code: 'MAILBOX_ACCESS_DENIED' });
    await grantMailboxAccess({ organisationId, mailboxId, actorId: ownerId, userId: staffId, permission: 'SEND' });
    await expect(assertMailboxPermission(organisationId, mailboxId, staffId, 'SEND')).resolves.toBeTruthy();
    await revokeMailboxAccess({ organisationId, mailboxId, actorId: ownerId, userId: staffId });
    await expect(assertMailboxPermission(organisationId, mailboxId, staffId, 'READ'))
      .rejects.toMatchObject({ code: 'MAILBOX_ACCESS_DENIED' });
  });

  it('revokes mailbox grants when an organisation membership is deactivated', async () => {
    await grantMailboxAccess({ organisationId, mailboxId, actorId: ownerId, userId: staffId, permission: 'READ' });
    await changeOrganisationMembership({ organisationId, actorId: ownerId, targetUserId: staffId, isActive: false });
    const grant = await prisma.mailboxAccess.findUnique({
      where: { mailboxId_userId: { mailboxId, userId: staffId } },
    });
    expect(grant?.revokedAt).not.toBeNull();
    await changeOrganisationMembership({ organisationId, actorId: ownerId, targetUserId: staffId, isActive: true });
    await expect(assertMailboxPermission(organisationId, mailboxId, staffId, 'READ'))
      .rejects.toMatchObject({ code: 'MAILBOX_ACCESS_DENIED' });
  });

  it('prevents revoking the last mailbox administrator', async () => {
    await grantMailboxAccess({ organisationId, mailboxId, actorId: ownerId, userId: staffId, permission: 'ADMINISTER' });
    await revokeMailboxAccess({ organisationId, mailboxId, actorId: ownerId, userId: ownerId });
    await expect(revokeMailboxAccess({ organisationId, mailboxId, actorId: staffId, userId: staffId }))
      .rejects.toMatchObject({ code: 'LAST_MAILBOX_ADMIN', statusCode: 409 });
  });
});
