# Frontend Architecture

React + TypeScript + Tailwind. Responsive web app; PWA is later. Feature-based architecture with focused components. Frontend uses MailForge API only; never connect directly to IMAP/SMTP.

Suggested areas: app/router/providers/layouts; features for auth, organisation, members, domains, providers, mailboxes, inbox, message view, compose, settings; shared UI/forms/feedback; API/auth/validation/formatting utilities.

## Screens
Admin workspace: organisation, staff/invitations, domains, provider configuration/health, mailboxes/access grants. Webmail: authorised mailbox switcher, folders/labels, bounded message list, reader, compose/reply/forward, search/preferences.

## UX
Show only authorised mailboxes. Provider capability flags determine available controls, but backend remains authoritative. Distinguish loading, unread, sync failure, send failure, and provider-accepted send. Do not show send success until API reports acceptance. Confirm permanent deletes. Mobile navigation must be keyboard accessible and focus-managed. Support keyboard navigation, semantic labels, reduced motion, and mobile layouts without horizontal overflow.

## State/security
Central API client and error handling. Never store provider credentials in frontend/browser storage. Avoid localStorage for message bodies/attachments. Invalidate mailbox caches on logout/revocation. Treat 403 as forbidden, not empty inbox.
## Phase 1 admin workspace implementation

The initial admin workspace provides login, invite acceptance, organisation selection, member listing, role/activation controls, pending invitation listing, invitation creation, and invitation revocation. The browser keeps the CSRF token in memory for the active page and obtains a fresh token from authenticated `GET /auth/csrf` on startup. The session credential remains in the HttpOnly API cookie; do not put it in localStorage or sessionStorage.
