import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertMailboxPermission: vi.fn(),
  findMailboxProviderForRead: vi.fn(),
}));

vi.mock('../mailboxes/mailboxes.service.js', () => ({
  assertMailboxPermission: mocks.assertMailboxPermission,
}));
vi.mock('./messages.db.js', () => ({
  findMailboxProviderForRead: mocks.findMailboxProviderForRead,
}));

import { getMailboxFolders, sanitizeMessageHtml, updateMailboxMessageReadState } from './messages.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sanitizeMessageHtml', () => {
  it('keeps basic formatting while removing scripts, images, styles and event handlers', () => {
    const html = sanitizeMessageHtml(
      '<h2 onclick="alert(1)">Hello</h2><script>steal()</script><img src="https://tracker.example/pixel"><p style="color:red">Safe text</p>',
    );

    expect(html).toContain('<h2>Hello</h2>');
    expect(html).toContain('Safe text');
    expect(html).not.toContain('script');
    expect(html).not.toContain('steal()');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('style=');
  });

  it('removes unsafe URL schemes from links', () => {
    const html = sanitizeMessageHtml('<a href="javascript:alert(1)">open</a>');
    expect(html).toContain('open</a>');
    expect(html).not.toContain('javascript:');
  });
});

describe('mailbox message authorisation', () => {
  it('checks the explicit READ grant before loading provider credentials', async () => {
    mocks.assertMailboxPermission.mockRejectedValue(new Error('MAILBOX_ACCESS_DENIED'));

    await expect(getMailboxFolders({
      organisationId: 'org_test',
      mailboxId: 'mailbox_test',
      actorId: 'user_test',
    })).rejects.toThrow('MAILBOX_ACCESS_DENIED');

    expect(mocks.assertMailboxPermission).toHaveBeenCalledWith(
      'org_test',
      'mailbox_test',
      'user_test',
      'READ',
    );
    expect(mocks.findMailboxProviderForRead).not.toHaveBeenCalled();
  });
});

describe('mailbox read-state authorisation', () => {
  it('requires MANAGE permission before provider access', async () => {
    mocks.assertMailboxPermission.mockRejectedValue(new Error('MAILBOX_MANAGE_REQUIRED'));

    await expect(updateMailboxMessageReadState({
      organisationId: 'org_test',
      mailboxId: 'mailbox_test',
      actorId: 'user_test',
      folderId: 'aW5ib3g',
      messageId: 'eyJ1aWRWYWxpZGl0eSI6IjEiLCJ1aWQiOjF9',
      unread: false,
    })).rejects.toThrow('MAILBOX_MANAGE_REQUIRED');

    expect(mocks.assertMailboxPermission).toHaveBeenCalledWith(
      'org_test',
      'mailbox_test',
      'user_test',
      'MANAGE',
    );
    expect(mocks.findMailboxProviderForRead).not.toHaveBeenCalled();
  });
});
