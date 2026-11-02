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