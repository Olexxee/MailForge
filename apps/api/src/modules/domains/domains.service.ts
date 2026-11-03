import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { domainToASCII } from 'node:url';
import { isIP } from 'node:net';
import { AppError } from '../../lib/http.js';
import { safeEqual } from '../../lib/crypto.js';
import { assertOrganisationRole } from '../organisations/organisations.service.js';
import {
  createDomainRecord,
  findDomainRecord,
  listDomainRecords,
  markDomainRecordVerified,
  rotateDomainVerificationToken,
} from './domains.db.js';

const normaliseDomain = (input: string): string => {
  const domain = domainToASCII(input.trim().replace(/\.$/, '').toLowerCase());
  if (!domain || !domain.includes('.') || isIP(domain) || domain.length > 253 || domain.split('.').some((label) =>
    label.length < 1 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  )) {
    throw new AppError('DOMAIN_INVALID', 400, 'Enter a valid domain name');
  }
  return domain;
};

export const getOrganisationDomains = async (organisationId: string, userId: string) => {
  await assertOrganisationRole(organisationId, userId, ['OWNER', 'ADMIN', 'STAFF']);
  return listDomainRecords(organisationId);
};

export const addOrganisationDomain = async (input: {
  organisationId: string;
  actorId: string;
  domain: string;
}) => {
  await assertOrganisationRole(input.organisationId, input.actorId, ['OWNER', 'ADMIN']);
  const name = normaliseDomain(input.domain);
  const verificationToken = randomBytes(32).toString('base64url');
  try {
    const domain = await createDomainRecord({
      organisationId: input.organisationId,
      name,
      verificationToken,
      createdById: input.actorId,
    });
    return {
      domain: { id: domain.id, name: domain.name, status: domain.status, createdAt: domain.createdAt },
      verificationRecord: {
        type: 'TXT' as const,
        host: `_mailforge-verification.${name}`,
        value: verificationToken,
      },
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new AppError('DOMAIN_ALREADY_EXISTS', 409, 'This domain is already registered in the organisation');
    }
    throw error;
  }
};

export const verifyOrganisationDomain = async (input: {
  organisationId: string;
  actorId: string;
  domainId: string;
}, dnsResolver: (hostname: string) => Promise<string[][]> = resolveTxt) => {
  await assertOrganisationRole(input.organisationId, input.actorId, ['OWNER', 'ADMIN']);
  const domain = await findDomainRecord(input.organisationId, input.domainId);
  if (!domain) throw new AppError('DOMAIN_NOT_FOUND', 404, 'Domain was not found');
  if (domain.status === 'VERIFIED') return { id: domain.id, name: domain.name, status: domain.status, verifiedAt: domain.verifiedAt };

  let records: string[][];
  try {
    records = await dnsResolver(`_mailforge-verification.${domain.name}`);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'ENODATA' || code === 'ENOTFOUND' || code === 'NXDOMAIN') {
      throw new AppError('DOMAIN_DNS_RECORD_NOT_FOUND', 409, 'The MailForge verification TXT record was not found yet');
    }
    throw new AppError('DOMAIN_DNS_LOOKUP_FAILED', 502, 'Could not verify the domain DNS record. Try again later');
  }
  const found = records.some((chunks) => safeEqual(chunks.join(''), domain.verificationToken));
  if (!found) {
    throw new AppError('DOMAIN_VERIFICATION_MISMATCH', 409, 'The DNS TXT record does not match this domain verification challenge');
  }
  await markDomainRecordVerified({
    organisationId: input.organisationId,
    domainId: domain.id,
    actorId: input.actorId,
    expectedToken: domain.verificationToken,
  });
  const updated = await findDomainRecord(input.organisationId, input.domainId);
  if (!updated) throw new AppError('DOMAIN_NOT_FOUND', 404, 'Domain was not found');
  if (updated.status !== 'VERIFIED') {
    throw new AppError('DOMAIN_CHALLENGE_CHANGED', 409, 'The verification challenge changed. Publish the current TXT value and try again');
  }
  return { id: updated.id, name: updated.name, status: updated.status, verifiedAt: updated.verifiedAt };
};

export const rotateOrganisationDomainChallenge = async (input: {
  organisationId: string;
  actorId: string;
  domainId: string;
}) => {
  await assertOrganisationRole(input.organisationId, input.actorId, ['OWNER', 'ADMIN']);
  const domain = await findDomainRecord(input.organisationId, input.domainId);
  if (!domain) throw new AppError('DOMAIN_NOT_FOUND', 404, 'Domain was not found');
  if (domain.status === 'VERIFIED') {
    throw new AppError('DOMAIN_ALREADY_VERIFIED', 409, 'A verified domain does not need a new challenge');
  }
  const verificationToken = randomBytes(32).toString('base64url');
  const updated = await rotateDomainVerificationToken({
    organisationId: input.organisationId,
    domainId: input.domainId,
    actorId: input.actorId,
    verificationToken,
  });
  if (updated !== 1) throw new AppError('DOMAIN_NOT_FOUND', 404, 'Pending domain was not found');
  return {
    verificationRecord: {
      type: 'TXT' as const,
      host: `_mailforge-verification.${domain.name}`,
      value: verificationToken,
    },
  };
};
