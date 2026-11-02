# Database Design

Conceptual schema for Phase 0 review; do not blindly implement every optional entity.

## Core entities
- Organization: name, unique slug, status.
- User: normalized email, display name, password hash or documented external identity, status.
- OrganizationMembership: organization/user, role OWNER/ADMIN/STAFF, status.
- OrganizationInvitation: email, role, token hash, expiry, acceptedAt, inviter.
- Domain: organisation, normalized domain name, status. Domain record only; not DNS management.
- ProviderConnection: organisation, provider type, auth type, encrypted credentials/token reference, status, capabilities, health state.
- Mailbox: organisation, domain, provider connection, email, display name, status, provider-specific identifier.
- MailboxAccess: mailbox, user, permission READ/SEND/MANAGE/ADMINISTER, grantor; unique mailbox/user.

## Operational entities
MailSyncState stores mailbox/folder-specific checkpoints, UIDVALIDITY/cursor, last sync and safe error. AuditLog records actor/action/resource/safe metadata/correlation ID. BackgroundJob/Outbox is optional and should be added only if required.

## Message cache
Do not store full bodies or attachments by default. If justified, cache provider-scoped message/folder IDs, sender/recipient/subject/date/flags and sync version. Provider IDs may be scoped or unstable; define uniqueness and invalidation.

## Constraints
Mailbox/domain/provider connection must belong to same organisation; access cannot cross organisations. Encrypt provider secrets with a key outside DB and source control. Deleting a MailForge mailbox record must not delete the real provider mailbox. Prefer deactivation where audit history matters. Transactions belong in repository/database layer.