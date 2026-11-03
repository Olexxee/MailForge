# Provider Integration

## GO54 initial configuration
IMAP host imap.go54mail.com, port 993, SSL/TLS. SMTP host smtp.go54mail.com, port 587, STARTTLS. Webmail https://webmail.go54mail.com/appsuite. These are user-provided setup notes, not proof that each mailbox has IMAP/SMTP enabled. Validate account/provider requirements. Never commit real credentials.

## Validation
Test IMAP authentication/folder listing and SMTP authentication/connectivity separately. Do not send a real email during validation unless user initiates it. Return safe status and redact protocol diagnostics.

## Adapter responsibilities
Define concrete interface in Phase 0: capabilities, validation, folders, paginated messages, message detail, attachment retrieval, send, read/unread, move/archive/trash/restore/delete if supported, sync.

## IMAP risks
UID is folder-scoped; UIDVALIDITY may change; sequence numbers are not durable. Folder names/special-use folders vary. Sent-folder placement may require a separate append/copy after SMTP. Handle flags, move semantics, timeouts, connection limits, bounded fetching, and checkpoints.

## SMTP risks
Enforce STARTTLS without downgrade. Validate sender identity. SMTP acceptance is not final delivery. Avoid blind retries. Limit message/attachment size and redact diagnostics.

## Google Workspace later
Do not assume mailbox-password IMAP. Plan OAuth consent/scopes, refresh/revocation, tenant policy, Gmail API semantics, labels, threads, search, and drafts. Add only after capability/security design.

## Resend separation
Resend remains for transactional app email. It is not a replacement for GO54 human mailbox IMAP/SMTP. Do not alter Resend or DNS/SPF/DKIM/DMARC without approval.

## Phase 2 GO54 adapter implementation

The first adapter uses ImapFlow for IMAP and Nodemailer for SMTP. IMAP and SMTP are deliberately checked independently; one can succeed while the other fails.

- IMAP: `imap.go54mail.com:993`, implicit TLS, certificate verification enabled, bounded connection/socket timeouts. The adapter authenticates and lists folders, then closes the connection.
- SMTP: `smtp.go54mail.com:587`, STARTTLS required (no cleartext fallback), TLS certificate verification enabled, TLS 1.2 minimum, bounded timeouts. The adapter calls SMTP transport verification only; it never sends a message.
- Provider hostnames and ports are fixed in the adapter rather than supplied by the browser. This prevents arbitrary-host connection/SSRF through provider configuration.
- No message read/send/folder mutation capability is advertised yet. Those capabilities are added in later phases after contract and provider-specific tests.
- GO54 account-level IMAP/SMTP access remains unconfirmed until the user explicitly authorises testing against a real mailbox. Network validation is not part of CI.
