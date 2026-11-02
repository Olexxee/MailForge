# Product Blueprint

MailForge is a private organisation email-management app connecting existing mail providers and providing one webmail interface for authorised staff. It is not a mail host or public SaaS.

## Initial organisation
- Domain: kpxacademy.com.ng
- Mailbox: admin@kpxacademy.com.ng
- Provider: GO54 Cloud Mail
- Resend remains separate for transactional application email. Do not alter Resend or DNS without explicit approval.

## Roles and access
Owner administers the organisation; Admin manages staff and mailbox configuration within policy; Staff uses assigned mailboxes. Mailbox permissions: READ, SEND, MANAGE, ADMINISTER. Every permission check is server-side. Organisation role alone must not automatically expose all mailboxes unless policy explicitly says so.

## Workflows
Owner signs in, adds a domain record (not DNS), configures and validates provider connection, registers mailbox, grants staff access. Staff signs in, sees authorised mailboxes, lists and reads messages, composes/replies/forwards, and sends through provider. Staff invitations must be single-use, expiring, and store only token hashes.

## Scope
Included: staff auth/invitations, domain/provider/mailbox administration, mailbox access, webmail, provider health, audit, sync, responsive UI. Excluded initially: own mail server, DNS/registrar, public SaaS/billing, spam infrastructure, calendar/contacts, AI email features, native mobile apps.

## MVP acceptance
An authorised staff member connects to GO54, lists and reads messages, sends and replies through MailForge, and sees honest provider errors. Provider acceptance is not final delivery. Credentials remain secret and mailbox isolation is tested.

## Risks
GO54 IMAP/SMTP access may require provider enablement. IMAP UID/UIDVALIDITY and folders vary. SMTP sending and sent-folder placement are distinct. Gmail/Workspace requires separate OAuth/API semantics. HTML email and attachments are security-sensitive.