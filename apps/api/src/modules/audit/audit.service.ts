import { writeAuditEvent } from './audit.db.js';

// Infrastructure-only module: audit writes are invoked by feature services and expose no HTTP routes.
export const recordAuditEvent = writeAuditEvent;
