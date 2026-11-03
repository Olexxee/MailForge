import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from './lib/api.js';

type Section = 'domains' | 'mailboxes';
type Domain = { id: string; name: string; status: 'PENDING' | 'VERIFIED'; verifiedAt: string | null; createdAt: string };
type VerificationRecord = { type: 'TXT'; host: string; value: string };
type Mailbox = {
  id: string;
  email: string;
  displayName: string | null;
  status: 'ACTIVE' | 'DISABLED';
  domain: { name: string; status: string };
  providerConnection: {
    id: string;
    providerType: string;
    imapStatus: 'UNKNOWN' | 'AVAILABLE' | 'UNAVAILABLE';
    smtpStatus: 'UNKNOWN' | 'AVAILABLE' | 'UNAVAILABLE';
    lastCheckedAt: string | null;
  };
  accessGrants: { permission: 'READ' | 'SEND' | 'MANAGE' | 'ADMINISTER' }[];
};
type MailboxGrant = {
  id: string;
  permission: 'READ' | 'SEND' | 'MANAGE' | 'ADMINISTER';
  createdAt: string;
  user: { id: string; email: string; displayName: string; isActive: boolean };
};

const statusLabel = (status: string) => status === 'AVAILABLE' ? 'Available' : status === 'UNAVAILABLE' ? 'Unavailable' : status;
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not checked';

export function Phase2Workspace({ organisationId, canManage, section }: {
  organisationId: string;
  canManage: boolean;
  section: Section;
}) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [verification, setVerification] = useState<VerificationRecord | null>(null);
  const [domainName, setDomainName] = useState('');
  const [domainId, setDomainId] = useState('');
  const [mailboxEmail, setMailboxEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mailboxPassword, setMailboxPassword] = useState('');
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [grants, setGrants] = useState<MailboxGrant[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [permission, setPermission] = useState<MailboxGrant['permission']>('READ');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [domainResult, mailboxResult] = await Promise.all([
        apiRequest<{ domains: Domain[] }>(`/organisations/${organisationId}/domains`),
        apiRequest<{ mailboxes: Mailbox[] }>(`/organisations/${organisationId}/mailboxes`),
      ]);
      setDomains(domainResult.domains);
      setMailboxes(mailboxResult.mailboxes);
      setDomainId((current) => domainResult.domains.some((item) => item.id === current && item.status === 'VERIFIED')
        ? current
        : domainResult.domains.find((item) => item.status === 'VERIFIED')?.id ?? '');
      setSelectedMailbox((current) => current ? mailboxResult.mailboxes.find((item) => item.id === current.id) ?? null : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load domain and mailbox data.');
    }
  }, [organisationId]);

  useEffect(() => {
    setVerification(null);
    setSelectedMailbox(null);
    setGrants([]);
    void load();
  }, [load]);

  const createDomain = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setVerification(null);
    try {
      const result = await apiRequest<{ domain: Domain; verificationRecord: VerificationRecord }>(
        `/organisations/${organisationId}/domains`,
        { method: 'POST', body: { domain: domainName } },
      );
      setVerification(result.verificationRecord);
      setDomainName('');
      setNotice('Domain added. Publish the TXT record, then verify ownership.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add domain.');
    } finally {
      setBusy(false);
    }
  };

  const verifyDomain = async (id: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/organisations/${organisationId}/domains/${id}/verify`, { method: 'POST' });
      setNotice('Domain ownership verified.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Domain verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const rotateChallenge = async (id: string) => {
    setBusy(true);
    setError('');
    setVerification(null);
    try {
      const result = await apiRequest<{ verificationRecord: VerificationRecord }>(
        `/organisations/${organisationId}/domains/${id}/verification-challenge`,
        { method: 'POST' },
      );
      setVerification(result.verificationRecord);
      setNotice('A new TXT challenge was generated. Replace the previous DNS value.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not generate a new DNS challenge.');
    } finally {
      setBusy(false);
    }
  };

  const connectMailbox = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/organisations/${organisationId}/mailboxes`, {
        method: 'POST',
        body: {
          domainId,
          email: mailboxEmail,
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
          password: mailboxPassword,
        },
      });
      setMailboxEmail('');
      setDisplayName('');
      setMailboxPassword('');
      setNotice('Mailbox registered. Run IMAP and SMTP validation separately.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect mailbox.');
    } finally {
      setBusy(false);
    }
  };

  const validateConnection = async (mailbox: Mailbox) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest<{ imap: { status: string }; smtp: { status: string }; emailSent: boolean }>(
        `/organisations/${organisationId}/provider-connections/${mailbox.providerConnection.id}/validate`,
        { method: 'POST' },
      );
      setNotice(`IMAP: ${statusLabel(result.imap.status)}. SMTP: ${statusLabel(result.smtp.status)}. No email was sent.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Provider validation failed.');
    } finally {
      setBusy(false);
    }
  };

  const openAccess = async (mailbox: Mailbox) => {
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ access: MailboxGrant[] }>(
        `/organisations/${organisationId}/mailboxes/${mailbox.id}/access`,
      );
      setSelectedMailbox(mailbox);
      setGrants(result.access);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load mailbox access.');
    } finally {
      setBusy(false);
    }
  };

  const grantAccess = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMailbox) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(
        `/organisations/${organisationId}/mailboxes/${selectedMailbox.id}/access`,
        { method: 'POST', body: { userId: targetUserId.trim(), permission } },
      );
      setTargetUserId('');
      const result = await apiRequest<{ access: MailboxGrant[] }>(
        `/organisations/${organisationId}/mailboxes/${selectedMailbox.id}/access`,
      );
      setGrants(result.access);
      setNotice('Mailbox access grant saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not grant mailbox access.');
    } finally {
      setBusy(false);
    }
  };

  const revokeAccess = async (userId: string) => {
    if (!selectedMailbox || !window.confirm('Revoke this user’s mailbox access?')) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(
        `/organisations/${organisationId}/mailboxes/${selectedMailbox.id}/access/${userId}`,
        { method: 'DELETE' },
      );
      setGrants((items) => items.filter((item) => item.user.id !== userId));
      setNotice('Mailbox access revoked.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not revoke mailbox access.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="phase2-stack">
      {error && <div className="alert-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {notice && <div className="alert-success" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}

      {section === 'domains' ? (
        <>
          <div className="page-heading">
            <div><p className="eyebrow">DOMAIN OWNERSHIP</p><h1>Domains</h1><p className="muted">Register organisation domains and verify control before connecting mailboxes.</p></div>
          </div>
          {canManage && <section className="panel">
            <div className="panel-heading"><div><h2>Add a domain</h2><p>MailForge will not change DNS records for you.</p></div><span className="panel-tag">DNS VERIFICATION</span></div>
            <form className="invite-form" onSubmit={createDomain}>
              <label>Domain name<input value={domainName} onChange={(e) => setDomainName(e.target.value)} placeholder="example.com.ng" autoCapitalize="none" required /></label>
              <button className="primary-button compact" disabled={busy}>Add domain <span>＋</span></button>
            </form>
            {verification && <div className="invite-created">
              <strong>Publish this DNS TXT record</strong>
              <p className="muted">Add the record at your DNS provider. This challenge is shown only once.</p>
              <div><span className="small-copy">Host / Name</span><code>{verification.host}</code></div>
              <div><span className="small-copy">Value</span><code>{verification.value}</code></div>
              <button className="secondary-button" onClick={() => {
                void navigator.clipboard.writeText(`${verification.host} TXT ${verification.value}`)
                  .catch(() => setError('Clipboard access failed. Copy the DNS record manually.'));
              }}>Copy DNS record</button>
            </div>}
          </section>}
          <section className="panel">
            <div className="panel-heading"><div><h2>Organisation domains</h2><p>{domains.length} registered domain{domains.length === 1 ? '' : 's'}</p></div><span className="panel-tag">DOMAIN INVENTORY</span></div>
            <div className="table-scroll"><table>
              <thead><tr><th>Domain</th><th>Status</th><th>Verified</th>{canManage && <th className="actions-col">Action</th>}</tr></thead>
              <tbody>{domains.map((domain) => <tr key={domain.id}>
                <td><strong>{domain.name}</strong></td>
                <td><span className={domain.status === 'VERIFIED' ? 'status active-status' : 'status pending-status'}><i />{domain.status}</span></td>
                <td>{dateLabel(domain.verifiedAt)}</td>
                {canManage && <td className="actions-col">{domain.status === 'PENDING' ? <div className="member-actions"><button className="small-action" disabled={busy} onClick={() => void verifyDomain(domain.id)}>Verify DNS</button><button className="small-action" disabled={busy} onClick={() => void rotateChallenge(domain.id)}>New TXT value</button></div> : <span className="protected-label">Verified</span>}</td>}
              </tr>)}
              {domains.length === 0 && <tr><td colSpan={canManage ? 4 : 3} className="table-empty">No domains registered yet.</td></tr>}</tbody>
            </table></div>
          </section>
        </>
      ) : (
        <>
          <div className="page-heading">
            <div><p className="eyebrow">CONNECTED PROVIDERS</p><h1>Mailboxes</h1><p className="muted">Only mailboxes explicitly granted to your account appear here.</p></div>
          </div>
          {canManage && <section className="panel">
            <div className="panel-heading"><div><h2>Connect a GO54 mailbox</h2><p>Select a verified domain. Credentials are encrypted before storage.</p></div><span className="panel-tag">GO54 CLOUD MAIL</span></div>
            <form className="invite-form mailbox-connect-form" onSubmit={connectMailbox}>
              <label>Verified domain<select value={domainId} onChange={(e) => setDomainId(e.target.value)} required>
                <option value="">Select a verified domain</option>
                {domains.filter((domain) => domain.status === 'VERIFIED').map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
              </select></label>
              <label>Mailbox email<input type="email" value={mailboxEmail} onChange={(e) => setMailboxEmail(e.target.value)} placeholder="name@example.com.ng" required /></label>
              <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Accounts Team" maxLength={100} /></label>
              <label>GO54 mailbox password<input type="password" autoComplete="new-password" value={mailboxPassword} onChange={(e) => setMailboxPassword(e.target.value)} required /></label>
              <button className="primary-button compact" disabled={busy || !domainId}>Connect mailbox <span>＋</span></button>
            </form>
            {domains.every((domain) => domain.status !== 'VERIFIED') && <p className="panel-footnote">Add and verify a domain before connecting a mailbox.</p>}
          </section>}
          <section className="panel">
            <div className="panel-heading"><div><h2>Your accessible mailboxes</h2><p>{mailboxes.length} mailbox{mailboxes.length === 1 ? '' : 'es'} available to your account</p></div><span className="panel-tag">MAILBOX ACCESS</span></div>
            <div className="table-scroll"><table>
              <thead><tr><th>Mailbox</th><th>IMAP</th><th>SMTP</th><th>Last checked</th><th className="actions-col">Actions</th></tr></thead>
              <tbody>{mailboxes.map((mailbox) => <tr key={mailbox.id}>
                <td><div className="member-cell"><div className="avatar subtle">@</div><div><strong>{mailbox.displayName || mailbox.email}</strong><span>{mailbox.email}</span><span className="small-copy">{mailbox.accessGrants[0]?.permission} access</span></div></div></td>
                <td><span className={mailbox.providerConnection.imapStatus === 'AVAILABLE' ? 'status active-status' : 'status pending-status'}><i />{statusLabel(mailbox.providerConnection.imapStatus)}</span></td>
                <td><span className={mailbox.providerConnection.smtpStatus === 'AVAILABLE' ? 'status active-status' : 'status pending-status'}><i />{statusLabel(mailbox.providerConnection.smtpStatus)}</span></td>
                <td>{dateLabel(mailbox.providerConnection.lastCheckedAt)}</td>
                <td className="actions-col"><div className="member-actions">
                  {mailbox.accessGrants.some((grant) => grant.permission === 'ADMINISTER') && <button className="small-action" disabled={busy} onClick={() => void openAccess(mailbox)}>Manage access</button>}
                  <button className="small-action" disabled={busy || !mailbox.accessGrants.some((grant) => grant.permission === 'ADMINISTER')} onClick={() => void validateConnection(mailbox)}>Validate</button>
                </div></td>
              </tr>)}
              {mailboxes.length === 0 && <tr><td colSpan={5} className="table-empty">No mailboxes have been granted to your account.</td></tr>}</tbody>
            </table></div>
            <p className="panel-footnote">Validation authenticates IMAP and SMTP separately. It never sends a test email. No message content is accessed in this phase.</p>
          </section>
          {selectedMailbox && <section className="panel">
            <div className="panel-heading"><div><h2>Access: {selectedMailbox.email}</h2><p>Manage explicit mailbox grants. Organisation roles do not grant mailbox access.</p></div><button className="small-action" onClick={() => setSelectedMailbox(null)}>Close</button></div>
            <form className="invite-form" onSubmit={grantAccess}>
              <label>Organisation user ID<input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} placeholder="Paste the user's ID" required /></label>
              <label>Permission<select value={permission} onChange={(e) => setPermission(e.target.value as MailboxGrant['permission'])}>
                <option value="READ">READ — view messages</option><option value="SEND">SEND — read and send</option><option value="MANAGE">MANAGE — read, send and organise</option><option value="ADMINISTER">ADMINISTER — full access and grants</option>
              </select></label>
              <button className="primary-button compact" disabled={busy}>Save access grant</button>
            </form>
            <div className="table-scroll"><table>
              <thead><tr><th>User</th><th>Permission</th><th>Action</th></tr></thead>
              <tbody>{grants.map((grant) => <tr key={grant.id}>
                <td><div><strong>{grant.user.displayName}</strong><span className="member-cell">{grant.user.email}</span></div></td>
                <td><span className="role-pill">{grant.permission}</span></td>
                <td><button className="small-action danger-action" disabled={busy} onClick={() => void revokeAccess(grant.user.id)}>Revoke</button></td>
              </tr>)}
              {grants.length === 0 && <tr><td colSpan={3} className="table-empty">No active grants.</td></tr>}</tbody>
            </table></div>
          </section>}
        </>
      )}
    </div>
  );
}
