import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './lib/api.js';

type Mailbox = { id: string; email: string; displayName: string | null };
type Folder = { id: string; name: string; specialUse: string | null };
type MessageSummary = {
  id: string;
  subject: string;
  from: string;
  to: string[];
  receivedAt: string;
  unread: boolean;
  flagged: boolean;
  size: number;
};
type MessageDetail = MessageSummary & {
  cc: string[];
  text: string;
  html: string | null;
  bodyTruncated: boolean;
  attachments: { partId: string; filename: string; contentType: string; size: number }[];
};

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));
const formatSize = (bytes: number) => bytes < 1024 ? bytes + ' B' : bytes < 1024 * 1024
  ? (bytes / 1024).toFixed(1) + ' KB'
  : (bytes / (1024 * 1024)).toFixed(1) + ' MB';

export function InboxWorkspace({ organisationId }: { organisationId: string }) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailboxId, setMailboxId] = useState('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState('');
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [error, setError] = useState('');

  const loadMailboxes = useCallback(async () => {
    setError('');
    try {
      const result = await apiRequest<{ mailboxes: Mailbox[] }>(`/organisations/${organisationId}/mailboxes`);
      setMailboxes(result.mailboxes);
      setMailboxId((current) => result.mailboxes.some((mailbox) => mailbox.id === current)
        ? current
        : result.mailboxes[0]?.id ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load accessible mailboxes.');
    }
  }, [organisationId]);

  useEffect(() => { void loadMailboxes(); }, [loadMailboxes]);

  const loadFolders = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError('');
    setSelectedMessage(null);
    setMessages([]);
    setNextCursor(null);
    setFolderId('');
    try {
      const result = await apiRequest<{ folders: Folder[] }>(
        `/organisations/${organisationId}/mailboxes/${id}/folders`,
      );
      setFolders(result.folders);
      const inbox = result.folders.find((folder) =>
        folder.specialUse?.toLowerCase() === '\\inbox' || folder.name.toLowerCase() === 'inbox',
      );
      setFolderId(inbox?.id ?? result.folders[0]?.id ?? '');
    } catch (cause) {
      setFolders([]);
      setError(cause instanceof Error ? cause.message : 'Could not load mailbox folders.');
    } finally {
      setLoading(false);
    }
  }, [organisationId]);

  useEffect(() => {
    if (mailboxId) void loadFolders(mailboxId);
    else setFolders([]);
  }, [mailboxId, loadFolders]);

  const loadMessages = useCallback(async (reset: boolean) => {
    if (!mailboxId || !folderId || loading) return;
    setLoading(true);
    setError('');
    try {
      const cursor = reset ? undefined : nextCursor;
      const params = new URLSearchParams({ limit: '25' });
      if (cursor) params.set('cursor', cursor);
      const result = await apiRequest<{ messages: MessageSummary[]; nextCursor: string | null }>(
        `/organisations/${organisationId}/mailboxes/${mailboxId}/folders/${folderId}/messages?${params.toString()}`,
      );
      setMessages((current) => reset ? result.messages : [...current, ...result.messages]);
      setNextCursor(result.nextCursor);
      if (reset) setSelectedMessage(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, [organisationId, mailboxId, folderId, loading, nextCursor]);

  useEffect(() => {
    if (mailboxId && folderId) void loadMessages(true);
  }, [mailboxId, folderId]); // Loading is intentionally triggered only when the selected mailbox/folder changes.

  const openMessage = async (message: MessageSummary) => {
    if (!mailboxId || !folderId) return;
    setLoadingMessage(true);
    setError('');
    try {
      const result = await apiRequest<{ message: MessageDetail }>(
        `/organisations/${organisationId}/mailboxes/${mailboxId}/folders/${folderId}/messages/${message.id}`,
      );
      setSelectedMessage(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open this message.');
    } finally {
      setLoadingMessage(false);
    }
  };

  return (
    <div className="phase2-stack">
      <div className="page-heading">
        <div><p className="eyebrow">MAILBOX</p><h1>Inbox</h1><p className="muted">Read messages from connected provider mailboxes. Access is checked on every request.</p></div>
      </div>
      {error && <div className="alert-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      <section className="panel">
        <div className="panel-heading">
          <div><h2>Mailbox</h2><p>Select a mailbox you have been granted access to.</p></div>
          <select aria-label="Mailbox" value={mailboxId} onChange={(event) => setMailboxId(event.target.value)} disabled={loading}>
            {mailboxes.map((mailbox) => <option key={mailbox.id} value={mailbox.id}>{mailbox.displayName || mailbox.email} · {mailbox.email}</option>)}
          </select>
        </div>
        {mailboxes.length === 0 && <p className="panel-footnote">No mailboxes are available to your account. Ask an organisation administrator for an explicit mailbox grant.</p>}
        {mailboxes.length > 0 && (
          <div className="inbox-layout">
            <nav className="inbox-folders" aria-label="Mailbox folders">
              <p className="eyebrow">FOLDERS</p>
              {folders.map((folder) => (
                <button key={folder.id} className={folder.id === folderId ? 'nav-item active' : 'nav-item'} style={{ width: '100%', textAlign: 'left' }} onClick={() => setFolderId(folder.id)}>
                  {folder.name}
                </button>
              ))}
              {folders.length === 0 && <p className="muted small-copy">{loading ? 'Loading folders…' : 'No folders returned.'}</p>}
            </nav>
            <div className="inbox-message-pane">
              {selectedMessage ? (
                <article>
                  <button className="small-action" onClick={() => setSelectedMessage(null)}>← Back to messages</button>
                  <h2 style={{ marginTop: 18 }}>{selectedMessage.subject}</h2>
                  <p className="muted small-copy">{selectedMessage.from} · {formatDate(selectedMessage.receivedAt)}</p>
                  <p className="small-copy"><strong>To:</strong> {selectedMessage.to.join(', ') || '—'}</p>
                  {selectedMessage.cc.length > 0 && <p className="small-copy"><strong>Cc:</strong> {selectedMessage.cc.join(', ')}</p>}
                  <hr />
                  {selectedMessage.html ? (
                    <iframe
                      title="Email message body"
                      sandbox=""
                      srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px/1.6 system-ui,sans-serif;color:#202124;overflow-wrap:anywhere}a{color:#2457c5}table{max-width:100%;border-collapse:collapse}td,th{padding:5px;border:1px solid #ddd}</style></head><body>${selectedMessage.html}</body></html>`}
                      style={{ width: '100%', minHeight: 440, border: '0', background: '#fff' }}
                    />
                  ) : (
                    <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: '14px/1.6 system-ui,sans-serif' }}>{selectedMessage.text || 'This message has no supported text body.'}</pre>
                  )}
                  {selectedMessage.bodyTruncated && <p className="panel-footnote">The message body is truncated at the current safe display limit.</p>}
                  {selectedMessage.attachments.length > 0 && (
                    <section style={{ marginTop: 24 }}>
                      <h3>Attachments</h3>
                      <ul>{selectedMessage.attachments.map((attachment) => <li key={attachment.partId}>{attachment.filename} · {formatSize(attachment.size)} <span className="muted">({attachment.contentType})</span></li>)}</ul>
                      <p className="panel-footnote">Attachment downloads are not enabled yet.</p>
                    </section>
                  )}
                </article>
              ) : (
                <>
                  <div className="panel-heading"><div><h2>Messages</h2><p>{messages.length} loaded</p></div><button className="small-action" onClick={() => void loadMessages(true)} disabled={loading}>Refresh</button></div>
                  {loadingMessage && <p className="muted">Opening message…</p>}
                  <div className="table-scroll">
                    <table>
                      <thead><tr><th>Sender / Subject</th><th>Received</th><th>Size</th></tr></thead>
                      <tbody>
                        {messages.map((message) => (
                          <tr key={message.id}>
                            <td><button className="inbox-message-button" onClick={() => void openMessage(message)}><strong style={{ fontWeight: message.unread ? 700 : 500 }}>{message.from}</strong><span>{message.subject}{message.flagged ? ' · ★' : ''}</span></button></td>
                            <td>{formatDate(message.receivedAt)}</td>
                            <td>{formatSize(message.size)}</td>
                          </tr>
                        ))}
                        {messages.length === 0 && !loading && <tr><td colSpan={3} className="table-empty">No messages in this folder.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {nextCursor && <div style={{ paddingTop: 16, textAlign: 'center' }}><button className="secondary-button" onClick={() => void loadMessages(false)} disabled={loading}>{loading ? 'Loading…' : 'Load older messages'}</button></div>}
                  {loading && <p className="muted small-copy">Loading mailbox data…</p>}
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
