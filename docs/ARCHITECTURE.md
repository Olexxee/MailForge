# Architecture

React/TypeScript frontend → HTTPS API → Node 22 / Express 5 → services → provider adapters → GO54 IMAP/SMTP. PostgreSQL/Prisma stores organisation and operational data. A worker handles sync/health checks. Frontend must never connect directly to IMAP/SMTP.

## Backend conventions
Use repository/database → service → controller → validator. Controllers are thin; services own business logic/provider orchestration; repository owns persistence and transactions. Use asyncWrapper, centralized errors, shared successResponse, Node ESM. Avoid route-level try/catch boilerplate; catch only at recovery boundaries. Keep files focused. No Mongoose, Go, or unnecessary pagination abstractions.

## Provider adapter
Services must not directly depend on GO54 protocol code. Define adapter interface during Phase 0 for validation, capabilities, folders, paginated messages, message details, attachments, sending, flags, move/archive/trash/delete when supported, and sync. Capability flags must reflect provider differences; Gmail labels are not identical to IMAP folders.

## Data ownership
Provider is source of truth for message bodies, attachments, folders, and mailbox state. Local DB stores organisation, users, domains, provider connections, mailbox access, encrypted credentials, and sync state. Do not replicate full mail bodies/attachments for MVP without approved retention design.

## Sync
Use worker for sync/health. Bounded retries, provider limits, per-mailbox concurrency control, correct UIDVALIDITY checkpoints. Never blindly retry sends.

## Deployment
Vercel frontend, Render API/worker, PostgreSQL. Keep API and worker separable. No production deployment without approval.