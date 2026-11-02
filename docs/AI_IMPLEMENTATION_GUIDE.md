# AI Implementation Guide (Binding)

Implement the approved blueprint incrementally. Do not redesign scope or begin coding before the user approves Phase 0.

## Rules
1. No scope changes without approval.
2. No own mail server, public SaaS, billing, registrar/DNS, spam infrastructure, calendar/contacts, or AI email features.
3. GO54 first; Gmail/Workspace later after provider-specific OAuth/API review.
4. Do not alter DNS, Resend, GO54 settings, credentials, or send real emails without approval.
5. No production deployment without approval.
6. Never store provider secrets plaintext, in frontend, logs, or Git.
7. Do not create branches unless user asks; do not merge main without approval.
8. Do not skip phase gates or claim tests/CI passed unless run.
9. Use Node 22, ESM, Express 5, PostgreSQL, Prisma unless approved otherwise.
10. Follow repository/database → service → controller → validator. Thin controllers, centralized errors, shared successResponse, asyncWrapper. Avoid route-level try/catch boilerplate.
11. Keep files focused; avoid premature abstractions.
12. Update docs and roadmap every phase.

## Workflow
Inspect repository/branch/CI/docs first. Identify phase and acceptance criteria. Surface contradictions before coding. Implement smallest coherent change. Add tests; run available lint/typecheck/tests/build; review security/provider assumptions; update docs; report changes, test evidence, risks, and next step.

## Stop and ask
If a choice affects architecture, provider access, credentials, retention, destructive behavior, or deployment and is not documented, explain options and wait for approval.