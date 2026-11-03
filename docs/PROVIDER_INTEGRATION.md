# Provider Integration

## GO54 initial configuration
The user's GO54 account settings show IMAP host `imap.go54mail.com`, port 993, SSL/TLS, and SMTP host `smtp.go54mail.com`, port 587, STARTTLS. The webmail URL shown by GO54 is https://webmail.go54mail.com/appsuite. These are account-screen settings, not proof that protocol access is enabled for every mailbox. The application configures only the hostnames and ports. The mailbox password is supplied through the authenticated mailbox-connection form, encrypted with AES-256-GCM, and stored in the database; it must never be placed in a committed config file or frontend bundle.

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

The first adapter uses ImapFlow for IMAP and Nodemailer for SMTP. IMAP and SMTP are checked independently; one can succeed while the other fails.

GO54's published Outlook setup guide documents the generic host `mail.yoursite.com`, IMAP SSL port 993, and SMTP SSL port 465. It also lists port 587 among non-SSL SMTP options. These are generic instructions, not confirmation of the exact endpoints for every GO54 Cloud Mail product or account. Confirm the exact IMAP and SMTP hostnames and supported ports in the mailbox's account settings or with GO54 support before configuring MailForge. See the [GO54 Outlook setup guide](https://knowledgebase.go54.com/en/article/29-setting-up-webmail-with-outlook).

- Set `GO54_IMAP_HOST`, `GO54_IMAP_PORT`, `GO54_SMTP_HOST`, and `GO54_SMTP_PORT` in the API environment. Defaults are IMAP 993 (implicit TLS) and SMTP 465 (implicit TLS); port 143 requires STARTTLS for IMAP and port 587 requires STARTTLS for SMTP.
- These endpoint values are server-side configuration only. The browser cannot supply arbitrary connection hosts.
- TLS certificate verification is enabled, TLS 1.2 is the minimum, and connection/socket timeouts are bounded. No plaintext fallback is allowed.
- IMAP validation authenticates and lists folders, then closes the connection. SMTP validation calls transport verification only; it never sends a message.
- No message read/send/folder mutation capability is advertised yet. Those capabilities are added in later phases after contract and provider-specific tests.
- GO54 account-level IMAP/SMTP access remains unconfirmed until the user explicitly authorises testing against a real mailbox. Network validation is not part of CI.


## Phase 3 read implementation

The GO54 adapter now exposes folders, bounded message pages, and message detail over IMAP. Pagination uses UIDs and includes UIDVALIDITY in its opaque cursor; a changed UIDVALIDITY forces a refresh rather than silently serving a different message. The adapter limits each body-part download to 256 KiB, returns attachment metadata only, and does not fetch or persist complete RFC822 source. API message HTML is sanitised with an allow-list before it reaches the browser. No IMAP write operation, SMTP send, attachment download, or sync job is introduced in this increment.


## Phase 3 attachments and flags

GO54 attachment retrieval validates the message identifier against the selected folder's current UIDVALIDITY, verifies that the MIME part is classified as an attachment, and streams at most 10 MiB. The IMAP connection and folder lock remain open only while the stream is consumed and are released even if the client disconnects. Responses are forced to `application/octet-stream` with a sanitised download filename and `nosniff`; message HTML never embeds attachments. Read/unread changes use the IMAP `\\Seen` flag and require a MANAGE or ADMINISTER mailbox grant at the API layer. Opening a message remains read-only.
