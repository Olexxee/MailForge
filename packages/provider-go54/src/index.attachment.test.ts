import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  mailbox: { uidValidity: '123', uidNext: 2 },
  connect: vi.fn(),
  logout: vi.fn(),
  close: vi.fn(),
  getMailboxLock: vi.fn(),
  release: vi.fn(),
  fetchOne: vi.fn(),
  download: vi.fn(),
  messageFlagsAdd: vi.fn(),
  messageFlagsRemove: vi.fn(),
}));

vi.mock('imapflow', () => ({
  ImapFlow: class {
    mailbox = state.mailbox;
    connect = state.connect;
    logout = state.logout;
    close = state.close;
    getMailboxLock = state.getMailboxLock;
    fetchOne = state.fetchOne;
    download = state.download;
    messageFlagsAdd = state.messageFlagsAdd;
    messageFlagsRemove = state.messageFlagsRemove;
    list = vi.fn(async () => []);
  },
}));

import { Go54Provider } from './index.js';

const messageId = Buffer.from(JSON.stringify({ uidValidity: '123', uid: 7 })).toString('base64url');

describe('Go54Provider attachment and read-state operations', () => {
  beforeEach(() => {
    state.mailbox.uidValidity = '123';
    process.env.GO54_IMAP_HOST = 'imap.go54mail.com';
    process.env.GO54_IMAP_PORT = '993';
    state.connect.mockResolvedValue(undefined);
    state.logout.mockResolvedValue(undefined);
    state.getMailboxLock.mockResolvedValue({ release: state.release });
    state.fetchOne.mockResolvedValue({
      bodyStructure: {
        type: 'application',
        subtype: 'pdf',
        part: '2',
        disposition: 'attachment',
        dispositionParameters: { filename: 'report.pdf' },
        size: 4,
      },
    });
    state.download.mockImplementation(async () => ({
      content: Readable.from([Buffer.from('data')]),
    }));
    state.messageFlagsAdd.mockResolvedValue(undefined);
    state.messageFlagsRemove.mockResolvedValue(undefined);
    state.release.mockClear();
    state.logout.mockClear();
    state.download.mockClear();
  });

  it('keeps the IMAP lock alive while streaming an attachment and releases it afterward', async () => {
    const provider = new Go54Provider({ email: 'admin@example.com', password: 'not-a-real-secret' });
    const result = await provider.downloadAttachment('INBOX', messageId, '2', 1024);

    expect(result).toMatchObject({ filename: 'report.pdf', size: 4, contentType: 'application/pdf' });
    expect(state.logout).not.toHaveBeenCalled();

    const chunks: Buffer[] = [];
    for await (const chunk of result!.stream) chunks.push(Buffer.from(chunk));

    expect(Buffer.concat(chunks).toString('utf8')).toBe('data');
    expect(state.release).toHaveBeenCalledOnce();
    expect(state.logout).toHaveBeenCalledOnce();
  });

  it('rejects oversized attachments before opening the content stream', async () => {
    const provider = new Go54Provider({ email: 'admin@example.com', password: 'not-a-real-secret' });
    await expect(provider.downloadAttachment('INBOX', messageId, '2', 2)).rejects.toMatchObject({
      code: 'ATTACHMENT_TOO_LARGE',
    });
    expect(state.download).not.toHaveBeenCalled();
    expect(state.logout).toHaveBeenCalledOnce();
  });

  it('rejects stale message identifiers before changing flags', async () => {
    state.mailbox.uidValidity = '456';
    const provider = new Go54Provider({ email: 'admin@example.com', password: 'not-a-real-secret' });

    await expect(provider.setMessageSeen('INBOX', messageId, true)).rejects.toMatchObject({
      code: 'MAILBOX_UIDVALIDITY_CHANGED',
    });
    expect(state.messageFlagsAdd).not.toHaveBeenCalled();
  });

  it('uses the UID seen flag to mark messages read and unread', async () => {
    const provider = new Go54Provider({ email: 'admin@example.com', password: 'not-a-real-secret' });
    await provider.setMessageSeen('INBOX', messageId, true);
    await provider.setMessageSeen('INBOX', messageId, false);

    expect(state.messageFlagsAdd).toHaveBeenCalledWith(7, ['\\Seen'], { uid: true });
    expect(state.messageFlagsRemove).toHaveBeenCalledWith(7, ['\\Seen'], { uid: true });
  });
});
