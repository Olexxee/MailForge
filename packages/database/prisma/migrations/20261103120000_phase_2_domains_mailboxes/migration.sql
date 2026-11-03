CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFIED');
CREATE TYPE "ProviderType" AS ENUM ('GO54');
CREATE TYPE "ProviderAuthType" AS ENUM ('PASSWORD');
CREATE TYPE "ProtocolStatus" AS ENUM ('UNKNOWN', 'AVAILABLE', 'UNAVAILABLE');
CREATE TYPE "MailboxStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "MailboxPermission" AS ENUM ('READ', 'SEND', 'MANAGE', 'ADMINISTER');

CREATE TABLE "Domain" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "verificationToken" TEXT NOT NULL,
  "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderConnection" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "providerType" "ProviderType" NOT NULL,
  "authType" "ProviderAuthType" NOT NULL DEFAULT 'PASSWORD',
  "accountEmail" TEXT NOT NULL,
  "encryptedCredentials" TEXT NOT NULL,
  "credentialKeyVersion" INTEGER NOT NULL,
  "imapStatus" "ProtocolStatus" NOT NULL DEFAULT 'UNKNOWN',
  "smtpStatus" "ProtocolStatus" NOT NULL DEFAULT 'UNKNOWN',
  "lastCheckedAt" TIMESTAMP(3),
  "lastSafeErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Mailbox" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "domainId" TEXT NOT NULL,
  "providerConnectionId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "status" "MailboxStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Mailbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MailboxAccess" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "mailboxId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" "MailboxPermission" NOT NULL,
  "grantedById" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MailboxAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Domain_organisationId_name_key" ON "Domain"("organisationId", "name");
CREATE UNIQUE INDEX "Domain_id_organisationId_key" ON "Domain"("id", "organisationId");
CREATE INDEX "Domain_organisationId_status_idx" ON "Domain"("organisationId", "status");
CREATE UNIQUE INDEX "ProviderConnection_organisationId_providerType_accountEmail_key" ON "ProviderConnection"("organisationId", "providerType", "accountEmail");
CREATE UNIQUE INDEX "ProviderConnection_id_organisationId_key" ON "ProviderConnection"("id", "organisationId");
CREATE INDEX "ProviderConnection_organisationId_providerType_idx" ON "ProviderConnection"("organisationId", "providerType");
CREATE UNIQUE INDEX "Mailbox_organisationId_email_key" ON "Mailbox"("organisationId", "email");
CREATE UNIQUE INDEX "Mailbox_id_organisationId_key" ON "Mailbox"("id", "organisationId");
CREATE INDEX "Mailbox_organisationId_status_idx" ON "Mailbox"("organisationId", "status");
CREATE INDEX "Mailbox_providerConnectionId_idx" ON "Mailbox"("providerConnectionId");
CREATE UNIQUE INDEX "MailboxAccess_mailboxId_userId_key" ON "MailboxAccess"("mailboxId", "userId");
CREATE INDEX "MailboxAccess_organisationId_userId_revokedAt_idx" ON "MailboxAccess"("organisationId", "userId", "revokedAt");
CREATE INDEX "MailboxAccess_mailboxId_revokedAt_idx" ON "MailboxAccess"("mailboxId", "revokedAt");

ALTER TABLE "Domain" ADD CONSTRAINT "Domain_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_domainId_organisationId_fkey"
FOREIGN KEY ("domainId", "organisationId") REFERENCES "Domain"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_providerConnectionId_organisationId_fkey"
FOREIGN KEY ("providerConnectionId", "organisationId") REFERENCES "ProviderConnection"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MailboxAccess" ADD CONSTRAINT "MailboxAccess_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxAccess" ADD CONSTRAINT "MailboxAccess_mailboxId_organisationId_fkey"
FOREIGN KEY ("mailboxId", "organisationId") REFERENCES "Mailbox"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxAccess" ADD CONSTRAINT "MailboxAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxAccess" ADD CONSTRAINT "MailboxAccess_grantedById_fkey"
FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
