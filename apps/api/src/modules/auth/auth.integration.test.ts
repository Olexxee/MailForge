import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, hashToken } from '../../lib/crypto.js';
import { getSession, issueSession, renewCsrfToken, revokeUserSession, rotateUserSession } from './auth.service.js';
import {
  acceptInvitation,
  acceptInvitationForExistingUser,
  inviteMember,
  revokeOrganisationInvitation,
} from '../invitations/invitations.service.js';
import { changeOrganisationMembership, getOrganisationMembers } from '../organisations/organisations.service.js';

const suffix = randomUUID();
const ownerEmail = `owner-${suffix}@mailforge.test`;
const adminEmail = `admin-${suffix}@mailforge.test`;
const staffEmail = `staff-${suffix}@mailforge.test`;
const userIds: string[] = [];
const organisationIds: string[] = [];
let ownerId = '';
let adminId = '';
let staffId = '';
let organisationId = '';
let secondOrganisationId = '';

describe('Phase 1 authentication and organisation workflows', () => {
  beforeAll(async () => {
    const [ownerPasswordHash, adminPasswordHash, staffPasswordHash] = await Promise.all([
      hashPassword('integration-test-password-123'),
      hashPassword('integration-test-password-123'),
      hashPassword('integration-test-password-123'),
    ]);
    const owner = await prisma.user.create({
      data: { email: ownerEmail, displayName: 'Test Owner', passwordHash: ownerPasswordHash },
    });
    const admin = await prisma.user.create({
      data: { email: adminEmail, displayName: 'Test Admin', passwordHash: adminPasswordHash },
    });
    const staff = await prisma.user.create({
      data: { email: staffEmail, displayName: 'Test Staff', passwordHash: staffPasswordHash },
    });
    userIds.push(owner.id, admin.id, staff.id);
    ownerId = owner.id;
    adminId = admin.id;
    staffId = staff.id;

    const organisation = await prisma.organisation.create({
      data: { name: 'MailForge Integration Test', slug: `test-${suffix}` },
    });
    const secondOrganisation = await prisma.organisation.create({
      data: { name: 'MailForge Second Test', slug: `second-${suffix}` },
    });
    organisationIds.push(organisation.id, secondOrganisation.id);
    organisationId = organisation.id;
    secondOrganisationId = secondOrganisation.id;

    await prisma.organizationMembership.createMany({
      data: [
        { organisationId, userId: ownerId, role: 'OWNER' },
        { organisationId, userId: adminId, role: 'ADMIN' },
        { organisationId, userId: staffId, role: 'STAFF' },
        { organisationId: secondOrganisationId, userId: ownerId, role: 'OWNER' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('denies staff access and blocks cross-organisation membership reads', async () => {
    await expect(getOrganisationMembers(organisationId, staffId))
      .rejects.toMatchObject({ code: 'ACCESS_DENIED', statusCode: 403 });
    await expect(getOrganisationMembers(secondOrganisationId, adminId))
      .rejects.toMatchObject({ code: 'ACCESS_DENIED', statusCode: 403 });
  });

  it('prevents admins from promoting staff or changing owners', async () => {
    await expect(changeOrganisationMembership({
      organisationId, actorId: adminId, targetUserId: staffId, role: 'ADMIN',
    })).rejects.toMatchObject({ code: 'ACCESS_DENIED', statusCode: 403 });

    await expect(changeOrganisationMembership({
      organisationId, actorId: adminId, targetUserId: ownerId, isActive: false,
    })).rejects.toMatchObject({ code: 'OWNER_PROTECTED', statusCode: 409 });
  });

  it('allows owners to manage staff but protects owner membership', async () => {
    const updated = await changeOrganisationMembership({
      organisationId, actorId: ownerId, targetUserId: staffId, role: 'ADMIN',
    });
    expect(updated.role).toBe('ADMIN');

    await expect(changeOrganisationMembership({
      organisationId, actorId: ownerId, targetUserId: ownerId, isActive: false,
    })).rejects.toMatchObject({ code: 'OWNER_PROTECTED', statusCode: 409 });
  });

  it('stores only invitation token hashes and accepts a new invited user once', async () => {
    const invitation = await inviteMember({
      organisationId, actorId: ownerId, email: `new-${suffix}@mailforge.test`, role: 'STAFF',
    });
    const stored = await prisma.organizationInvitation.findUnique({ where: { id: invitation.id } });
    expect(stored?.tokenHash).toBe(hashToken(invitation.token));
    expect(stored?.tokenHash).not.toBe(invitation.token);

    const accepted = await acceptInvitation({
      token: invitation.token,
      displayName: 'Invited Staff',
      password: 'a-secure-password-123',
    });
    userIds.push(accepted.userId);
    const membership = await prisma.organizationMembership.findUnique({
      where: { organisationId_userId: { organisationId, userId: accepted.userId } },
    });
    expect(membership?.role).toBe('STAFF');
    await expect(acceptInvitation({
      token: invitation.token,
      displayName: 'Invited Staff',
      password: 'a-secure-password-123',
    })).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
  });

  it('allows an existing account to accept only a matching email invitation', async () => {
    const invitation = await inviteMember({
      organisationId: secondOrganisationId, actorId: ownerId, email: adminEmail, role: 'ADMIN',
    });
    await expect(acceptInvitationForExistingUser({
      token: invitation.token, userId: adminId, email: 'wrong@mailforge.test',
    })).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    await acceptInvitationForExistingUser({
      token: invitation.token, userId: adminId, email: adminEmail,
    });
    const membership = await prisma.organizationMembership.findUnique({
      where: { organisationId_userId: { organisationId: secondOrganisationId, userId: adminId } },
    });
    expect(membership?.role).toBe('ADMIN');
  });

  it('lists pending invitations only for organisation administrators', async () => {\n    const invitation = await inviteMember({\n      organisationId, actorId: ownerId, email: `listed-${suffix}@mailforge.test`, role: 'STAFF',\n    });\n    const listed = await getPendingInvitations(organisationId, adminId);\n    expect(listed.some((item) => item.id === invitation.id)).toBe(true);\n    await expect(getPendingInvitations(organisationId, staffId))\n      .rejects.toMatchObject({ code: 'ACCESS_DENIED', statusCode: 403 });\n  });\n\n  it('rejects expired invitations', async () => {
    const token = `expired-${suffix}-invitation-token-1234567890`;
    await prisma.organizationInvitation.create({
      data: {
        organisationId,
        email: `expired-${suffix}@mailforge.test`,
        role: 'STAFF',
        tokenHash: hashToken(token),
        inviterId: ownerId,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    await expect(acceptInvitation({
      token, displayName: 'Expired User', password: 'a-secure-password-123',
    })).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
  });

  it('rejects revoked invitations', async () => {
    const invitation = await inviteMember({
      organisationId, actorId: ownerId, email: `revoked-${suffix}@mailforge.test`, role: 'STAFF',
    });
    await revokeOrganisationInvitation({ organisationId, invitationId: invitation.id, actorId: ownerId });
    await expect(acceptInvitation({
      token: invitation.token,
      displayName: 'Revoked User',
      password: 'a-secure-password-123',
    })).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
  });

  it('rotates sessions atomically and rejects revoked tokens', async () => {
    const initial = await issueSession(ownerId);
    const initialRecord = await getSession(initial.sessionToken);
    expect(initialRecord).not.toBeNull();
    const csrfToken = await renewCsrfToken(initialRecord!.id);\n    const csrfUpdatedSession = await getSession(initial.sessionToken);\n    expect(csrfUpdatedSession?.csrfTokenHash).toBe(hashToken(csrfToken));\n    const rotated = await rotateUserSession(initialRecord!.id, ownerId, initial.absoluteExpiresAt);
    expect(await getSession(initial.sessionToken)).toBeNull();
    const active = await getSession(rotated.sessionToken);
    expect(active).not.toBeNull();
    await revokeUserSession(active!.id);
    expect(await getSession(rotated.sessionToken)).toBeNull();
  });
});
