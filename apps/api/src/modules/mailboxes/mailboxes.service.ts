import { domainToASCII } from 'node:url';
import { AppError } from '../../lib/http.js';
import { encryptCredential } from '../../lib/credential-encryption.js';
import {
  createMailboxConnectionTransaction,
  findActiveMembership,
  findMailboxByEmail,
  findMailboxGrant,
  findMailboxInOrganisation,
  findVerifiedDomain,
  listMailboxGrants,
  listMailboxesForUser,
  revokeMailboxGrant,
  upsertMailboxGrant,
} from './mailboxes.db.js';
import { assertOrganisationRole } from '../organisations/organisations.service.js';

export type MailboxPermission = 'READ' | 'SEND' | 'MANAGE' | 'ADMINISTER';
const permissionRank: Record<MailboxPermission, number> = {
  READ: 1,
  SEND: 2,
  MANAGE: 3,
  ADMINISTER: 4,
};

export const getMailboxes = async (organisationId: string, userId: string) => {
  await assertOrganisationRole(organisationId, userId, ['OWNER', 'ADMIN', 'STAFF']);
  return listMailboxesForUser(organisationId, userId);
};

export const connectGo54Mailbox = async (input: {
  organisationId: string;
  actorId: string;
  domainId: string;
  email: string;
  displayName?: string;
  password: string;
}) => {
  await assertOrganisationRole(input.organisationId, input.actorId, ['OWNER', 'ADMIN']);
  const emailInput = input.email.trim().toLowerCase();
  const separator = emailInput.lastIndexOf('@');
  if (separator < 1) throw new AppError('MAILBOX_EMAIL_INVALID', 400, 'Enter a valid mailbox email address');
  const emailDomain = domainToASCII(emailInput.slice(separator + 1));
  const email = emailDomain ? `${emailInput.slice(0, separator)}@${emailDomain}` : emailInput;
  const domain = await findVerifiedDomain(input.organisationId, input.domainId);
  if (!domain) throw new AppError('DOMAIN_NOT_VERIFIED', 409, 'Verify the organisation domain before connecting a mailbox');
  if (!emailDomain || emailDomain !== domain.name) {
    throw new AppError('MAILBOX_DOMAIN_MISMATCH', 400, 'The mailbox email must use the selected verified domain');
  }
  if (await findMailboxByEmail(input.organisationId, email)) {
    throw new AppError('MAILBOX_ALREADY_REGISTERED', 409, 'This mailbox is already registered');
  }
  let encrypted: { ciphertext: string; keyVersion: number };
  try {
    encrypted = encryptCredential(JSON.stringify({ password: input.password }), `${input.organisationId}:${email}`);
  } catch {
    throw new AppError(
      'CREDENTIAL_ENCRYPTION_UNAVAILABLE',
      503,
      'Provider credential encryption is not configured. Configure the credential keyring before connecting mailboxes',
    );
  }
  try {
    return await createMailboxConnectionTransaction({
      organisationId: input.organisationId,
      domainId: domain.id,
      email,
      ...(input.displayName?.trim() ? { displayName: input.displayName.trim() } : {}),
      encryptedCredentials: encrypted.ciphertext,
      credentialKeyVersion: encrypted.keyVersion,
      actorId: input.actorId,
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new AppError('MAILBOX_ALREADY_REGISTERED', 409, 'This mailbox is already registered');
    }
    throw error;
  }
};

export const assertMailboxPermission = async (
  organisationId: string,
  mailboxId: string,
  userId: string,
  required: MailboxPermission,
) => {
  const membership = await findActiveMembership(organisationId, userId);
  if (!membership) throw new AppError('ACCESS_DENIED', 403, 'Active organisation membership is required');
  const mailbox = await findMailboxInOrganisation(organisationId, mailboxId);
  if (!mailbox) throw new AppError('MAILBOX_NOT_FOUND', 404, 'Mailbox was not found');
  const grant = await findMailboxGrant(organisationId, mailboxId, userId);
  if (!grant || grant.revokedAt || permissionRank[grant.permission] < permissionRank[required]) {
    throw new AppError('MAILBOX_ACCESS_DENIED', 403, 'You do not have the required permission for this mailbox');
  }
  return mailbox;
};

export const getMailboxAccess = async (input: { organisationId: string; mailboxId: string; actorId: string }) => {
  await assertMailboxPermission(input.organisationId, input.mailboxId, input.actorId, 'ADMINISTER');
  const grants = await listMailboxGrants(input.organisationId, input.mailboxId);
  return grants.map(({ membership, ...grant }) => ({ ...grant, user: membership.user }));
};

export const grantMailboxAccess = async (input: {
  organisationId: string;
  mailboxId: string;
  actorId: string;
  userId: string;
  permission: MailboxPermission;
}) => {
  await assertMailboxPermission(input.organisationId, input.mailboxId, input.actorId, 'ADMINISTER');
  const targetMembership = await findActiveMembership(input.organisationId, input.userId);
  if (!targetMembership) throw new AppError('TARGET_NOT_ACTIVE_MEMBER', 409, 'Access can only be granted to an active organisation member');
  let grant;
  try {
    grant = await upsertMailboxGrant({
      organisationId: input.organisationId,
      mailboxId: input.mailboxId,
      userId: input.userId,
      permission: input.permission,
      grantedById: input.actorId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'MAILBOX_ADMIN_ACCESS_REVOKED') {
      throw new AppError('MAILBOX_ACCESS_DENIED', 403, 'Mailbox administrator access is no longer active');
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
      throw new AppError('ACCESS_UPDATE_CONFLICT', 409, 'Mailbox membership or access changed concurrently. Reload and retry');
    }
    throw error;
  }
  if (!grant) throw new AppError('TARGET_NOT_ACTIVE_MEMBER', 409, 'Access can only be granted to an active organisation member');
  return { id: grant.id, permission: grant.permission, createdAt: grant.createdAt, user: grant.membership.user };
};

export const revokeMailboxAccess = async (input: {
  organisationId: string;
  mailboxId: string;
  actorId: string;
  userId: string;
}) => {
  await assertMailboxPermission(input.organisationId, input.mailboxId, input.actorId, 'ADMINISTER');
  const grant = await findMailboxGrant(input.organisationId, input.mailboxId, input.userId);
  if (!grant || grant.revokedAt) throw new AppError('MAILBOX_GRANT_NOT_FOUND', 404, 'Mailbox access grant was not found');
  let result: number;
  try {
    result = await revokeMailboxGrant({
      organisationId: input.organisationId,
      mailboxId: input.mailboxId,
      userId: input.userId,
      actorId: input.actorId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'MAILBOX_ADMIN_ACCESS_REVOKED') {
      throw new AppError('MAILBOX_ACCESS_DENIED', 403, 'Mailbox administrator access is no longer active');
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
      throw new AppError('ACCESS_UPDATE_CONFLICT', 409, 'Mailbox access changed concurrently. Reload and retry');
    }
    throw error;
  }
  if (result === -1) {
    throw new AppError('LAST_MAILBOX_ADMIN', 409, 'Grant ADMINISTER access to another active member before revoking the last administrator');
  }
  if (result !== 1) throw new AppError('MAILBOX_GRANT_NOT_FOUND', 404, 'Mailbox access grant was not found');
  return { revoked: true };
};
