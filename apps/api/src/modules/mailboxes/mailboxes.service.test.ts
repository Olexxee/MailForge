import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  countActiveMailboxAdministrators: vi.fn(),
  createMailboxConnectionTransaction: vi.fn(),
  findActiveMembership: vi.fn(),
  findMailboxByEmail: vi.fn(),
  findMailboxGrant: vi.fn(),
  findMailboxInOrganisation: vi.fn(),
  findVerifiedDomain: vi.fn(),
  listMailboxGrants: vi.fn(),
  listMailboxesForUser: vi.fn(),
  revokeMailboxGrant: vi.fn(),
  upsertMailboxGrant: vi.fn(),
  assertOrganisationRole: vi.fn(),
}));

vi.mock('./mailboxes.db.js', () => mocks);
vi.mock('../organisations/organisations.service.js', () => ({
  assertOrganisationRole: mocks.assertOrganisationRole,
}));

import { assertMailboxPermission } from './mailboxes.service.js';

describe('mailbox permission enforcement', () => {
  beforeEach(() => vi.resetAllMocks());

  it('does not infer mailbox access from an active organisation membership', async () => {
    mocks.findActiveMembership.mockResolvedValue({ id: 'membership_1234567890' });
    mocks.findMailboxInOrganisation.mockResolvedValue({
      id: 'mailbox_1234567890',
      email: 'admin@example.com',
      status: 'ACTIVE',
    });
    mocks.findMailboxGrant.mockResolvedValue(null);

    await expect(assertMailboxPermission(
      'org_1234567890',
      'mailbox_1234567890',
      'owner_1234567890',
      'READ',
    )).rejects.toMatchObject({
      code: 'MAILBOX_ACCESS_DENIED',
      statusCode: 403,
    });
  });

  it('enforces the explicit permission hierarchy', async () => {
    mocks.findActiveMembership.mockResolvedValue({ id: 'membership_1234567890' });
    mocks.findMailboxInOrganisation.mockResolvedValue({
      id: 'mailbox_1234567890',
      email: 'admin@example.com',
      status: 'ACTIVE',
    });
    mocks.findMailboxGrant.mockResolvedValue({ permission: 'SEND', revokedAt: null });

    await expect(assertMailboxPermission(
      'org_1234567890',
      'mailbox_1234567890',
      'staff_1234567890',
      'READ',
    )).resolves.toMatchObject({ id: 'mailbox_1234567890' });

    await expect(assertMailboxPermission(
      'org_1234567890',
      'mailbox_1234567890',
      'staff_1234567890',
      'MANAGE',
    )).rejects.toMatchObject({ code: 'MAILBOX_ACCESS_DENIED' });
  });

  it('rejects access after organisation membership is deactivated', async () => {
    mocks.findActiveMembership.mockResolvedValue(null);
    await expect(assertMailboxPermission(
      'org_1234567890',
      'mailbox_1234567890',
      'staff_1234567890',
      'READ',
    )).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    expect(mocks.findMailboxInOrganisation).not.toHaveBeenCalled();
  });
});
