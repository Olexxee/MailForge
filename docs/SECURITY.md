# Security Requirements

Email access is sensitive; security is a release blocker.

## Threats
Mailbox IDOR/privilege escalation, stolen staff sessions, provider credential theft, malicious HTML/attachments, forged invitations, provider/log leakage, duplicate sends, sync abuse, and resource exhaustion.

## Mandatory controls
- Reviewed authentication/session design; hash passwords if local auth.
- Secure HttpOnly cookies and CSRF protection if cookie sessions are used; refresh rotation/revocation if token sessions are used.
- Rate-limit login, invitation, provider validation, and sensitive actions. No public signup; controlled owner bootstrap.
- Enforce mailbox permissions on every backend operation and validate organisation/resource relationships.
- Encrypt provider passwords/app passwords/OAuth tokens at rest. Key must be in deployment secret/KMS, not database or Git. Plan key rotation.
- Never expose provider secrets to frontend/logs. Redact provider errors.
- Sanitise HTML; disable scripts, event handlers, unsafe URLs, and dangerous embedded content.
- Attachment access requires mailbox authorization, bounded streaming/size limits, and non-public URLs.
- Email content is untrusted and must never trigger privileged actions.
- Audit access grants, staff/provider changes, and sensitive actions without storing bodies, attachments, passwords, or tokens.
- TLS, strict CORS, secure headers, validation, request limits, dependency checks, backups.

## Release gate
Tests prove mailbox isolation, secret encryption/redaction, HTML sanitization, attachment authorization/limits, invitation/session revocation, and safe provider errors before real mailbox features are complete.

## Authentication implementation baseline

- Passwords use Node.js `scrypt` with a per-password random 16-byte salt and fixed, versioned parameters. Password hashes are never returned or logged. Unknown-email login attempts perform a dummy KDF operation to reduce timing-based account enumeration. Login is rate-limited.
- Session cookies are HttpOnly; CSRF cookies are separate and readable by the frontend. Authenticated state-changing requests require a matching cookie/header token whose digest is bound to the server-side session, plus an allowed Origin when the browser supplies one. Production cookies require Secure and SameSite=Lax for same-site cross-origin frontend/API hosting; deploy frontend and API under the same registrable domain or a same-site reverse proxy to avoid third-party-cookie blocking.
- Only SHA-256 digests of random session and invitation tokens are persisted. Sessions rotate atomically, are revocable, expire after seven idle days, and have a 30-day absolute lifetime.
- Owner bootstrap is CLI-only, serialised with a PostgreSQL transaction advisory lock, and refuses to run once an active owner exists. Bootstrap credentials are temporary environment variables and must not be committed.
- Invitation tokens expire after seven days and are single-use/revocable. Until email delivery is integrated, the raw token is returned once to an authorised administrator for secure manual distribution; do not paste it into logs, tickets, or public channels.
- Organisation role checks are performed in services on every organisation-management operation. Organisation roles do not grant mailbox access; Phase 2 must implement separate mailbox grants.
- The current login limiter uses the process-local express-rate-limit store. Multi-instance production deployments must replace it with a shared store before exposing authentication publicly.


## Phase 2 provider credential and mailbox controls

- GO54 passwords are encrypted with AES-256-GCM using a random 96-bit IV and authentication tag. The database stores the versioned ciphertext and key version; plaintext credentials exist only in the request/service process while validating a connection.
- Configure `CREDENTIAL_ENCRYPTION_KEYS_JSON` as a JSON map from integer key versions to base64-encoded 32-byte keys, and `CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION` as the active version. Keep the keyring in deployment secrets, never PostgreSQL or Git. Retain old key versions until all records encrypted with them have been re-encrypted and verified.
- Domain ownership requires a DNS TXT challenge. Mailbox creation is blocked until the domain is VERIFIED. MailForge does not modify DNS.
- GO54 IMAP and SMTP checks are independent. IMAP uses implicit TLS on port 993; SMTP uses required STARTTLS on port 587 with certificate verification and TLS 1.2 minimum. Validation does not send an email.
- Provider validation requires an active ADMINISTER grant for the mailbox. It does not grant the caller message-reading rights beyond that grant.
- Mailbox grants are separate from organisation roles. Every mailbox access check requires an active organisation membership and a sufficient active mailbox grant. Composite foreign keys constrain mailbox/domain/provider connection records to the same organisation.
- The creator receives ADMINISTER access on a newly connected mailbox. The last active mailbox administrator cannot be revoked.
- Protocol diagnostics and credential values are never returned or logged. Persist only safe protocol status and error codes.
