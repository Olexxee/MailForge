import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertOrganisationRole: vi.fn(),
  createDomainRecord: vi.fn(),
  findDomainRecord: vi.fn(),
  listDomainRecords: vi.fn(),
  markDomainRecordVerified: vi.fn(),
}));

vi.mock('../organisations/organisations.service.js', () => ({
  assertOrganisationRole: mocks.assertOrganisationRole,
}));
vi.mock('./domains.db.js', () => ({
  createDomainRecord: mocks.createDomainRecord,
  findDomainRecord: mocks.findDomainRecord,
  listDomainRecords: mocks.listDomainRecords,
  markDomainRecordVerified: mocks.markDomainRecordVerified,
}));

import { addOrganisationDomain, verifyOrganisationDomain } from './domains.service.js';

describe('domain ownership verification', () => {
  beforeEach(() => vi.resetAllMocks());

  it('normalises a domain and returns a DNS TXT challenge', async () => {
    mocks.createDomainRecord.mockImplementation(async (input) => ({
      id: 'domain_1234567890',
      name: input.name,
      status: 'PENDING',
      createdAt: new Date('2026-11-03T00:00:00.000Z'),
      verificationToken: input.verificationToken,
    }));

    const result = await addOrganisationDomain({
      organisationId: 'org_1234567890',
      actorId: 'user_1234567890',
      domain: ' KPxAcademy.COM.NG ',
    });

    expect(mocks.createDomainRecord).toHaveBeenCalledWith(expect.objectContaining({
      name: 'kpxacademy.com.ng',
    }));
    expect(result.domain.status).toBe('PENDING');
    expect(result.verificationRecord.host).toBe('_mailforge-verification.kpxacademy.com.ng');
    expect(result.verificationRecord.value).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });

  it('marks a domain verified only when the exact TXT challenge is published', async () => {
    const domain = {
      id: 'domain_1234567890',
      name: 'kpxacademy.com.ng',
      status: 'PENDING',
      verificationToken: 'published-random-challenge',
      verifiedAt: null,
    };
    mocks.findDomainRecord.mockResolvedValueOnce(domain).mockResolvedValueOnce({
      ...domain,
      status: 'VERIFIED',
      verifiedAt: new Date('2026-11-03T00:00:00.000Z'),
    });
    mocks.markDomainRecordVerified.mockResolvedValue(1);

    const result = await verifyOrganisationDomain({
      organisationId: 'org_1234567890',
      actorId: 'user_1234567890',
      domainId: domain.id,
    }, async (hostname) => {
      expect(hostname).toBe('_mailforge-verification.kpxacademy.com.ng');
      return [['published-random-', 'challenge']];
    });

    expect(mocks.markDomainRecordVerified).toHaveBeenCalledOnce();
    expect(result.status).toBe('VERIFIED');
  });

  it('rejects a TXT value that does not match the challenge', async () => {
    mocks.findDomainRecord.mockResolvedValue({
      id: 'domain_1234567890',
      name: 'example.com',
      status: 'PENDING',
      verificationToken: 'expected-value',
    });

    await expect(verifyOrganisationDomain({
      organisationId: 'org_1234567890',
      actorId: 'user_1234567890',
      domainId: 'domain_1234567890',
    }, async () => [['wrong-value']])).rejects.toMatchObject({
      code: 'DOMAIN_VERIFICATION_MISMATCH',
      statusCode: 409,
    });
    expect(mocks.markDomainRecordVerified).not.toHaveBeenCalled();
  });
});
