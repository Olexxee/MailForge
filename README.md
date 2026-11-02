# MailForge

Private, multi-domain email management for an organisation.

**Status:** Blueprint phase. No application implementation has been approved or started.

MailForge connects existing email providers and gives authorised staff one unified webmail and administration interface. It is not an email host and will not operate its own mail server.

## Initial target

- Organisation: user's private organisation
- First domain: kpxacademy.com.ng
- First mailbox: admin@kpxacademy.com.ng
- First provider: GO54 Cloud Mail
- Resend remains separate for transactional application email.

## Goals

- Manage multiple organisation-owned domains in one dashboard.
- Connect existing provider mailboxes.
- Assign staff and mailbox-level permissions.
- Read, compose, reply, forward, search, and organise email.
- Keep provider credentials and mailbox operations server-side.
- Add providers incrementally without claiming feature parity.

## Scope boundaries

In scope: staff access, domain/provider/mailbox administration, existing-provider integrations, unified webmail, security, audit, sync, responsive web app.

Out of scope initially: own mail server, domain registrar/DNS management, public SaaS signup, billing, spam infrastructure, AI email features, calendar/contacts, native mobile apps.

## Technology direction

Planning defaults (not permission to implement before blueprint approval): React + TypeScript + Tailwind; Node.js 22 + Express 5 + ESM; PostgreSQL + Prisma; API prefix /api/v1; frontend Vercel; backend/worker Render.

## Documentation

- [Product Blueprint](docs/PRODUCT_BLUEPRINT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database Design](docs/DATABASE_DESIGN.md)
- [API Contracts](docs/API_CONTRACTS.md)
- [Provider Integration](docs/PROVIDER_INTEGRATION.md)
- [Security](docs/SECURITY.md)
- [Frontend Architecture](docs/FRONTEND_ARCHITECTURE.md)
- [Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md)
- [AI Implementation Guide](docs/AI_IMPLEMENTATION_GUIDE.md)
- [Decision Log](docs/DECISION_LOG.md)

## MVP success criterion

An authorised staff member signs in, opens the GO54 mailbox, reads a message, and sends a reply through MailForge without opening GO54 Webmail. The provider accepts the send and the sent message is reflected in the provider mailbox where supported.

## Non-negotiable rules

1. Provider remains the source of truth for email content and mailbox state initially.
2. Every mailbox operation is permission-checked server-side.
3. Provider credentials never reach the browser and are never stored/logged in plaintext.
4. Provider capabilities differ; do not promise unsupported parity.
5. Email and attachments are untrusted input; sanitise and authorise access.
6. Keep controllers thin; repository/database → service → controller → validator; central errors and shared response helpers.
7. Implement only approved roadmap phases and update documentation.
8. No production deployment, DNS changes, provider credential changes, or destructive mailbox actions without explicit approval.

## Status

- [x] Repository created
- [x] Blueprint documentation added
- [ ] User review and approval
- [ ] Phase 0 foundation
- [ ] GO54 integration
- [ ] MVP inbox/send workflow

No runnable application exists yet. Review the blueprint before implementation.

MailForge is a working name; verify naming/domain/trademark availability before public launch.