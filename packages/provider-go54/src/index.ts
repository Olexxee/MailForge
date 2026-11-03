import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { ProviderCapabilityError, type MailProvider, type ProviderCapability, type ProviderHealth } from '@mailforge/provider-core';

export const GO54_PROVIDER_ID = 'go54' as const;
export const GO54_IMAP_HOST = 'imap.go54mail.com';
export const GO54_SMTP_HOST = 'smtp.go54mail.com';

export interface Go54Credentials {
  email: string;
  password: string;
}

export interface Go54HealthChecks {
  checkImap: () => Promise<void>;
  checkSmtp: () => Promise<void>;
}

const safeErrorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code)) return code;
  }
  return 'PROVIDER_CONNECTION_FAILED';
};

const checkImap = async (credentials: Go54Credentials): Promise<void> => {
  const client = new ImapFlow({
    host: GO54_IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: credentials.email, pass: credentials.password },
    logger: false,
    connectionTimeout: 10_000,
    socketTimeout: 10_000,
  });
  let connected = false;
  try {
    await client.connect();
    connected = true;
    await client.list();
  } finally {
    if (connected) await client.logout().catch(() => undefined);
    else client.close();
  }
};

const checkSmtp = async (credentials: Go54Credentials): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: GO54_SMTP_HOST,
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: credentials.email, pass: credentials.password },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    logger: false,
    debug: false,
  });
  try {
    await transporter.verify();
  } finally {
    transporter.close();
  }
};

export class Go54Provider implements MailProvider {
  readonly providerId = GO54_PROVIDER_ID;
  private readonly healthChecks: Go54HealthChecks;

  constructor(credentials: Go54Credentials, healthChecks?: Go54HealthChecks) {
    this.healthChecks = healthChecks ?? {
      checkImap: () => checkImap(credentials),
      checkSmtp: () => checkSmtp(credentials),
    };
  }

  capabilities(): ReadonlySet<ProviderCapability> {
    // Message operations are added in Phase 3/4 after provider behaviour is verified.
    return new Set<ProviderCapability>();
  }

  async checkHealth(): Promise<ProviderHealth> {
    const [imap, smtp] = await Promise.allSettled([
      this.healthChecks.checkImap(),
      this.healthChecks.checkSmtp(),
    ]);
    return {
      imap: imap.status === 'fulfilled' ? 'available' : 'unavailable',
      smtp: smtp.status === 'fulfilled' ? 'available' : 'unavailable',
      checkedAt: new Date(),
      ...(imap.status === 'rejected' ? { imapErrorCode: safeErrorCode(imap.reason) } : {}),
      ...(smtp.status === 'rejected' ? { smtpErrorCode: safeErrorCode(smtp.reason) } : {}),
    };
  }

  async listMessages(): Promise<never> {
    throw new ProviderCapabilityError('listMessages');
  }
}
