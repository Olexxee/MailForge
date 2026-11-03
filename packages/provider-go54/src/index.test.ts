import { afterEach, describe, expect, it, vi } from 'vitest';
import { Go54Provider } from './index.js';

const endpointEnv = ['GO54_IMAP_HOST', 'GO54_IMAP_PORT', 'GO54_SMTP_HOST', 'GO54_SMTP_PORT'] as const;
const previousEndpointEnv = Object.fromEntries(endpointEnv.map((key) => [key, process.env[key]]));
afterEach(() => {
  for (const key of endpointEnv) {
    const value = previousEndpointEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('Go54Provider health checks', () => {
  it('reports IMAP and SMTP independently', async () => {
    const provider = new Go54Provider(
      { email: 'mail@example.com', password: 'never-log-this' },
      {
        checkImap: vi.fn().mockResolvedValue(undefined),
        checkSmtp: vi.fn().mockRejectedValue(Object.assign(new Error('sensitive server detail'), { code: 'EAUTH' })),
      },
    );

    const health = await provider.checkHealth();

    expect(health.imap).toBe('available');
    expect(health.smtp).toBe('unavailable');
    expect(health.smtpErrorCode).toBe('EAUTH');
    expect(JSON.stringify(health)).not.toContain('sensitive server detail');
    expect(JSON.stringify(health)).not.toContain('never-log-this');
  });

  it('does not claim either protocol works when both checks fail', async () => {
    const provider = new Go54Provider(
      { email: 'mail@example.com', password: 'not-a-real-password' },
      {
        checkImap: vi.fn().mockRejectedValue(new Error('IMAP secret diagnostic')),
        checkSmtp: vi.fn().mockRejectedValue(new Error('SMTP secret diagnostic')),
      },
    );

    const health = await provider.checkHealth();

    expect(health.imap).toBe('unavailable');
    expect(health.smtp).toBe('unavailable');
    expect(health.imapErrorCode).toBe('PROVIDER_CONNECTION_FAILED');
    expect(health.smtpErrorCode).toBe('PROVIDER_CONNECTION_FAILED');
    expect(JSON.stringify(health)).not.toContain('secret diagnostic');
  });
});

describe('GO54 endpoint configuration', () => {
  it('reports missing IMAP and SMTP endpoints independently without network access', async () => {
    for (const key of endpointEnv) delete process.env[key];
    const provider = new Go54Provider({ email: 'mail@example.com', password: 'not-a-real-password' });
    const health = await provider.checkHealth();
    expect(health.imap).toBe('unavailable');
    expect(health.smtp).toBe('unavailable');
    expect(health.imapErrorCode).toBe('GO54_IMAP_HOST_NOT_CONFIGURED');
    expect(health.smtpErrorCode).toBe('GO54_SMTP_HOST_NOT_CONFIGURED');
  });
});
