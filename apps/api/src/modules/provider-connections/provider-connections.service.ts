import { Go54Provider } from '@mailforge/provider-go54';
import { AppError } from '../../lib/http.js';
import { decryptCredential } from '../../lib/credential-encryption.js';
import { assertMailboxPermission } from '../mailboxes/mailboxes.service.js';
import { findProviderConnection, updateProviderHealth } from './provider-connections.db.js';

export const validateProviderConnection = async (input: {
  organisationId: string;
  connectionId: string;
  actorId: string;
}) => {
  const connection = await findProviderConnection(input.organisationId, input.connectionId);
  if (!connection) throw new AppError('PROVIDER_CONNECTION_NOT_FOUND', 404, 'Provider connection was not found');
  const mailbox = connection.mailboxes.find((item) => item.status === 'ACTIVE');
  if (!mailbox) throw new AppError('MAILBOX_NOT_FOUND', 404, 'Active mailbox for this provider connection was not found');
  await assertMailboxPermission(input.organisationId, mailbox.id, input.actorId, 'ADMINISTER');

  let credentials: { password: string };
  try {
    const plaintext = decryptCredential(connection.encryptedCredentials, connection.credentialKeyVersion);
    const parsed: unknown = JSON.parse(plaintext);
    if (!parsed || typeof parsed !== 'object' || !('password' in parsed) || typeof parsed.password !== 'string') {
      throw new Error('invalid credential payload');
    }
    credentials = { password: parsed.password };
  } catch {
    throw new AppError('CREDENTIAL_DECRYPTION_FAILED', 503, 'Stored provider credentials cannot be decrypted. Check the configured credential keyring');
  }

  const provider = new Go54Provider({ email: connection.accountEmail, password: credentials.password });
  const health = await provider.checkHealth();
  const imapStatus = health.imap === 'available' ? 'AVAILABLE' : 'UNAVAILABLE';
  const smtpStatus = health.smtp === 'available' ? 'AVAILABLE' : 'UNAVAILABLE';
  const safeErrorCode = imapStatus === 'UNAVAILABLE' && smtpStatus === 'UNAVAILABLE'
    ? 'IMAP_AND_SMTP_CHECK_FAILED'
    : imapStatus === 'UNAVAILABLE'
      ? health.imapErrorCode ?? 'IMAP_CHECK_FAILED'
      : smtpStatus === 'UNAVAILABLE'
        ? health.smtpErrorCode ?? 'SMTP_CHECK_FAILED'
        : null;
  await updateProviderHealth({
    organisationId: input.organisationId,
    connectionId: input.connectionId,
    imapStatus,
    smtpStatus,
    lastCheckedAt: health.checkedAt,
    lastSafeErrorCode: safeErrorCode,
    actorId: input.actorId,
  });
  return {
    provider: connection.providerType,
    accountEmail: connection.accountEmail,
    imap: { status: health.imap, errorCode: health.imapErrorCode ?? null },
    smtp: { status: health.smtp, errorCode: health.smtpErrorCode ?? null },
    checkedAt: health.checkedAt,
    emailSent: false,
  };
};
