import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ApiError,
  apiRequest,
  bootstrapSession,
  setCsrfToken,
  type Invitation,
  type Member,
  type Organisation,
  type User,
} from './lib/api.js';

type Page = 'members' | 'invitations';
type InviteResult = { invitationToken: string; invitation: { id: string; email: string; role: string; expiresAt: string } };

const readInviteToken = () => {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('invite') ?? '';
};
const clearInviteToken = () => window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
const inviteUrl = (token: string) => `${window.location.origin}/#invite=${encodeURIComponent(token)}`;
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [organisationId, setOrganisationId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [page, setPage] = useState<Page>('members');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteToken, setInviteToken] = useState(readInviteToken);
  const [showInviteLogin, setShowInviteLogin] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<InviteResult | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [acceptName, setAcceptName] = useState('');
  const [acceptPassword, setAcceptPassword] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'STAFF' | 'ADMIN'>('STAFF');

  const currentOrganisation = useMemo(
    () => organisations.find((organisation) => organisation.id === organisationId) ?? null,
    [organisations, organisationId],
  );
  const canManage = currentOrganisation?.role === 'OWNER' || currentOrganisation?.role === 'ADMIN';
  const activeMemberCount = members.filter((member) => member.isActive).length;

  useEffect(() => {
    if (currentOrganisation?.role !== 'OWNER' && inviteRole === 'ADMIN') setInviteRole('STAFF');
  }, [currentOrganisation?.role, inviteRole]);

  const loadWorkspace = useCallback(async (activeUser: User) => {
    setUser(activeUser);
    const result = await apiRequest<{ organisations: Organisation[] }>('/organisations');
    setOrganisations(result.organisations);
    const nextOrganisation = result.organisations[0];
    if (!nextOrganisation) {
      setOrganisationId('');
      setMembers([]);
      setInvitations([]);
      return;
    }
    setOrganisationId(nextOrganisation.id);
    if (nextOrganisation.role === 'OWNER' || nextOrganisation.role === 'ADMIN') {
      const [memberResult, invitationResult] = await Promise.all([
        apiRequest<{ members: Member[] }>(`/organisations/${nextOrganisation.id}/members`),
        apiRequest<{ invitations: Invitation[] }>(`/organisations/${nextOrganisation.id}/invitations`),
      ]);
      setMembers(memberResult.members);
      setInvitations(invitationResult.invitations);
    } else {
      setMembers([]);
      setInvitations([]);
    }
  }, []);

  const reloadOrganisation = useCallback(async (id: string) => {
    const selected = organisations.find((item) => item.id === id);
    setOrganisationId(id);
    if (!selected || (selected.role !== 'OWNER' && selected.role !== 'ADMIN')) {
      setPage('members');
      setMembers([]);
      setInvitations([]);
      return;
    }
    const [memberResult, invitationResult] = await Promise.all([
      apiRequest<{ members: Member[] }>(`/organisations/${id}/members`),
      apiRequest<{ invitations: Invitation[] }>(`/organisations/${id}/invitations`),
    ]);
    setMembers(memberResult.members);
    setInvitations(invitationResult.invitations);
  }, [organisations]);

  useEffect(() => {
    let active = true;
    const start = async () => {
      try {
        const result = await bootstrapSession();
        if (active) await loadWorkspace(result.user);
      } catch (cause) {
        if (active && !(cause instanceof ApiError && cause.status === 401)) {
          setError(cause instanceof Error ? cause.message : 'Unable to restore your session.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void start();
    return () => { active = false; };
  }, [loadWorkspace]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ user: User; csrfToken: string }>('/auth/login', {
        method: 'POST',
        body: { email: loginEmail, password: loginPassword },
      });
      setCsrfToken(result.csrfToken);
      await loadWorkspace(result.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleNewInvitationAcceptance = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ user: { userId: string }; csrfToken: string }>('/invitations/accept', {
        method: 'POST',
        body: { token: inviteToken, displayName: acceptName, password: acceptPassword },
      });
      setCsrfToken(result.csrfToken);
      clearInviteToken();
      setInviteToken('');
      const current = await apiRequest<{ user: User }>('/auth/me');
      await loadWorkspace(current.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invitation acceptance failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleExistingInvitationAcceptance = async () => {
    setBusy(true);
    setError('');
    try {
      await apiRequest('/invitations/accept-existing', { method: 'POST', body: { token: inviteToken } });
      clearInviteToken();
      setInviteToken('');
      const current = await apiRequest<{ user: User }>('/auth/me');
      await loadWorkspace(current.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invitation acceptance failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError('');
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      setCsrfToken(undefined);
      setUser(null);
      setOrganisations([]);
      setOrganisationId('');
      setMembers([]);
      setInvitations([]);
      setCreatedInvite(null);
      setPage('members');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign out failed.');
    } finally {
      setBusy(false);
    }
  };

  const createInvitation = async (event: FormEvent) => {
    event.preventDefault();
    if (!organisationId) return;
    setBusy(true);
    setError('');
    setCreatedInvite(null);
    try {
      const result = await apiRequest<InviteResult>(`/organisations/${organisationId}/invitations`, {
        method: 'POST',
        body: { email: inviteEmail, role: inviteRole },
      });
      setCreatedInvite(result);
      setInviteEmail('');
      const refreshed = await apiRequest<{ invitations: Invitation[] }>(`/organisations/${organisationId}/invitations`);
      setInvitations(refreshed.invitations);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create invitation.');
    } finally {
      setBusy(false);
    }
  };

  const revokeInvite = async (invitationId: string) => {
    if (!organisationId || !window.confirm('Revoke this pending invitation? The link will stop working.')) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/organisations/${organisationId}/invitations/${invitationId}/revoke`, { method: 'POST' });
      setInvitations((items) => items.filter((item) => item.id !== invitationId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not revoke invitation.');
    } finally {
      setBusy(false);
    }
  };

  const updateMember = async (member: Member, update: { role?: 'ADMIN' | 'STAFF'; isActive?: boolean }) => {
    if (!organisationId) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ membership: Member }>(
        `/organisations/${organisationId}/members/${member.user.id}`,
        { method: 'PATCH', body: update },
      );
      setMembers((items) => items.map((item) => item.id === result.membership.id ? result.membership : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update member.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="loading-screen"><div className="brand-mark">M</div><p>Loading MailForge…</p></main>;
  }

  if (inviteToken && !user && !showInviteLogin) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-lockup"><div className="brand-mark">M</div><span>MailForge</span></div>
          <p className="eyebrow">SECURE INVITATION</p>
          <h1>Join your organisation.</h1>
          <p className="muted">Create your account to accept this invitation. Your password must be at least 12 characters.</p>
          <form onSubmit={handleNewInvitationAcceptance} className="stack-form">
            <label>Full name<input autoComplete="name" value={acceptName} onChange={(e) => setAcceptName(e.target.value)} required maxLength={100} /></label>
            <label>Create password<input type="password" autoComplete="new-password" value={acceptPassword} onChange={(e) => setAcceptPassword(e.target.value)} required minLength={12} maxLength={256} /></label>
            {error && <p className="error-text">{error}</p>}
            <button className="primary-button" disabled={busy}>{busy ? 'Accepting…' : 'Create account and join'}</button>
          </form>
          <p className="muted small-copy">Already have an account? <button className="text-button" onClick={() => setShowInviteLogin(true)}>Sign in first</button> to accept this invitation.</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-lockup"><div className="brand-mark">M</div><span>MailForge</span></div>
          <p className="eyebrow">PRIVATE ORGANISATION EMAIL</p>
          <h1>One workspace.<br />Every mailbox.</h1>
          <p className="muted">Sign in to manage your organisation's connected mailboxes.</p>
          <form onSubmit={handleLogin} className="stack-form">
            <label>Work email<input type="email" autoComplete="username" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required /></label>
            <label>Password<input type="password" autoComplete="current-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required /></label>
            {error && <p className="error-text">{error}</p>}
            <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          {inviteToken && <p className="muted small-copy"><button className="text-button" onClick={() => setShowInviteLogin(false)}>Back to invitation</button></p>}
          <p className="muted small-copy">Access is invitation-only. Public registration is disabled.</p>
        </section>
      </main>
    );
  }

  if (inviteToken && user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-lockup"><div className="brand-mark">M</div><span>MailForge</span></div>
          <p className="eyebrow">ORGANISATION INVITATION</p>
          <h1>Accept invitation.</h1>
          <p className="muted">You are signed in as <strong>{user.email}</strong>. The invitation can only be accepted if its email matches your account.</p>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-button" disabled={busy} onClick={() => void handleExistingInvitationAcceptance()}>
            {busy ? 'Accepting…' : 'Accept invitation'}
          </button>
          <button className="text-button full-width" onClick={() => { clearInviteToken(); setInviteToken(''); }}>Cancel</button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark">M</div><span>MailForge</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <label className="organisation-picker">
          <span>Organisation</span>
          <select value={organisationId} onChange={(e) => void reloadOrganisation(e.target.value)}>
            {organisations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <nav className="side-nav" aria-label="Organisation administration">
          <button className={page === 'members' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('members')}>
            <span className="nav-icon">◎</span> Members
          </button>
          {canManage && <button className={page === 'invitations' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('invitations')}>
            <span className="nav-icon">＋</span> Invitations <span className="nav-count">{invitations.length}</span>
          </button>}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div className="user-meta"><strong>{user.displayName}</strong><span>{user.email}</span></div>
          </div>
          <button className="signout-button" onClick={() => void handleLogout()} disabled={busy}>Sign out <span>↗</span></button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div><span className="breadcrumb">Workspace</span><span className="breadcrumb-separator">/</span><strong>{page === 'members' ? 'Members' : 'Invitations'}</strong></div>
          <div className="topbar-right"><span className="secure-indicator"><i /> Secure session</span><span className="role-pill">{currentOrganisation?.role ?? 'MEMBER'}</span><button className="signout-top" onClick={() => void handleLogout()} disabled={busy}>Sign out</button></div>
        </header>

        <div className="content-wrap">
          {error && <div className="alert-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
          {!currentOrganisation ? (
            <section className="empty-state"><div className="empty-icon">⌂</div><h2>No organisation access</h2><p>Your account is not an active member of an organisation. Ask an owner to invite you.</p></section>
          ) : page === 'members' ? (
            <>
              <div className="page-heading">
                <div><p className="eyebrow">PEOPLE & ACCESS</p><h1>Members</h1><p className="muted">Manage who can access {currentOrganisation.name}.</p></div>
                {canManage && <button className="primary-button compact" onClick={() => setPage('invitations')}>Invite a member <span>＋</span></button>}
              </div>
              {canManage ? (
                <section className="panel">
                  <div className="panel-heading"><div><h2>Organisation members</h2><p>{activeMemberCount} active member{activeMemberCount === 1 ? '' : 's'} · {members.length} total</p></div><span className="panel-tag">ACCESS CONTROL</span></div>
                  <div className="table-scroll">
                    <table>
                      <thead><tr><th>Member</th><th>Role</th><th>Status</th><th className="actions-col">Manage</th></tr></thead>
                      <tbody>
                        {members.map((member) => (
                          <tr key={member.id}>
                            <td><div className="member-cell"><div className="avatar subtle">{member.user.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{member.user.displayName}</strong><span>{member.user.email}</span></div></div></td>
                            <td><span className={`role-pill role-${member.role.toLowerCase()}`}>{member.role}</span></td>
                            <td><span className={member.isActive ? 'status active-status' : 'status inactive-status'}><i />{member.isActive ? 'Active' : 'Inactive'}</span></td>
                            <td className="actions-col">
                              {member.role === 'OWNER' ? <span className="protected-label">Protected</span> : (
                                <div className="member-actions">
                                  {currentOrganisation.role === 'OWNER' && <select aria-label={`Role for ${member.user.email}`} value={member.role} disabled={busy || !member.isActive} onChange={(e) => void updateMember(member, { role: e.target.value as 'ADMIN' | 'STAFF' })}>
                                    <option value="STAFF">Staff</option><option value="ADMIN">Admin</option>
                                  </select>}
                                  <button className={member.isActive ? 'small-action danger-action' : 'small-action'} disabled={busy} onClick={() => void updateMember(member, { isActive: !member.isActive })}>
                                    {member.isActive ? 'Deactivate' : 'Reactivate'}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {members.length === 0 && <tr><td colSpan={4} className="table-empty">No active members found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <p className="panel-footnote">Owners are protected from removal. Administrators can manage staff; only owners can assign administrator privileges.</p>
                </section>
              ) : (
                <section className="panel"><div className="panel-heading"><div><h2>Your organisation</h2><p>Member directory access is restricted to organisation administrators.</p></div></div><p className="muted">You are signed in as a staff member. Your mailbox permissions will be managed separately from your organisation role.</p></section>
              )}
            </>
          ) : (
            <>
              <div className="page-heading"><div><p className="eyebrow">ACCESS ONBOARDING</p><h1>Invitations</h1><p className="muted">Invite colleagues and control outstanding access links.</p></div></div>
              <section className="panel invite-panel">
                <div className="panel-heading"><div><h2>Invite someone</h2><p>Invitation links expire after seven days and can only be used once.</p></div><span className="panel-tag">NEW INVITATION</span></div>
                <form className="invite-form" onSubmit={createInvitation}>
                  <label>Email address<input type="email" placeholder="name@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required /></label>
                  <label>Organisation role<select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'STAFF' | 'ADMIN')}>
                    <option value="STAFF">Staff</option>{currentOrganisation.role === 'OWNER' && <option value="ADMIN">Administrator</option>}
                  </select></label>
                  <button className="primary-button compact" disabled={busy}>Create invitation <span>＋</span></button>
                </form>
                {createdInvite && (
                  <div className="invite-created">
                    <div><strong>Invitation created</strong><p>Share this link through an approved secure channel. It is shown only once.</p></div>
                    <code>{inviteUrl(createdInvite.invitationToken)}</code>
                    <button className="secondary-button" onClick={() => void navigator.clipboard.writeText(inviteUrl(createdInvite.invitationToken))}>Copy invitation link</button>
                  </div>
                )}
              </section>
              <section className="panel">
                <div className="panel-heading"><div><h2>Pending invitations</h2><p>{invitations.length} unexpired invitation{invitations.length === 1 ? '' : 's'}</p></div><span className="panel-tag">AWAITING ACCEPTANCE</span></div>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Email</th><th>Role</th><th>Invited by</th><th>Expires</th><th className="actions-col">Action</th></tr></thead>
                    <tbody>
                      {invitations.map((invitation) => (
                        <tr key={invitation.id}>
                          <td><strong>{invitation.email}</strong></td>
                          <td><span className={`role-pill role-${invitation.role.toLowerCase()}`}>{invitation.role}</span></td>
                          <td>{invitation.inviter.displayName}</td>
                          <td>{formatDate(invitation.expiresAt)}</td>
                          <td className="actions-col"><button className="small-action danger-action" disabled={busy} onClick={() => void revokeInvite(invitation.id)}>Revoke</button></td>
                        </tr>
                      ))}
                      {invitations.length === 0 && <tr><td colSpan={5} className="table-empty">No pending invitations. Create one above.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
