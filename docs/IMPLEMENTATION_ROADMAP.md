# Implementation Roadmap

Do not skip phase gates. Blueprint approval is required before coding.

## Phase 0 — Foundation
Confirm single vs split repositories, auth/session design, credential encryption/key management, provider adapter interface, GO54 test access, Prisma schema, API/error conventions, CI/lint/typecheck/test setup, redacted logging, fake provider adapter.
Exit: decisions documented, CI passes clean checkout, schema/contracts reviewed, no secrets committed.

## Phase 1 — Auth and organisation
Owner bootstrap, login/logout/session revocation, organisation/membership, invitations, role policy, audit foundation, admin UI.
Exit: owner invites staff, staff accepts and signs in, permission/revocation tests pass, no public signup.

## Phase 2 — Domains/provider/mailboxes
Domain records, encrypted provider connection, GO54 IMAP/SMTP validation, mailbox registration/access grants, health status.
Exit: both protocols validated separately, access enforced, encryption/redaction tests pass, no email sent during validation.

## Phase 3 — Inbox/read
Folders, bounded message pagination, message detail/body, read state, HTML sanitization, authorized attachments, sync checkpoints as needed.
Exit: authorized users read mail; unauthorized IDs denied; safe HTML; bounded large content; honest errors.

## Phase 4 — Compose/send
Compose, reply/forward, attachment limits, SMTP send, sent-folder placement, duplicate-send protection.
Exit: end-to-end send/reply; acceptance distinguished from delivery; no blind retries.

## Phase 5 — Productivity
Search, move/archive/trash/restore, drafts, signatures, preferences, sync improvements, PWA polish only where provider supports.
Exit: provider-specific tests and no false feature parity.

## Phase 6 — More providers/hardening
Google Workspace OAuth/API, more adapters, monitoring, backup/recovery, security/performance review.
Exit: auth reviewed, security checks complete, backup/restore tested, production deployment explicitly approved.

Every phase requires tests, CI, docs updates, security review, honest status, and user review before proceeding.