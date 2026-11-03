import 'dotenv/config';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/crypto.js';

const schema = z.object({
  BOOTSTRAP_OWNER_EMAIL: z.string().email().max(254).transform((value) => value.toLowerCase()),
  BOOTSTRAP_OWNER_PASSWORD: z.string().min(12).max(256),
  BOOTSTRAP_OWNER_NAME: z.string().trim().min(1).max(100),
  BOOTSTRAP_ORGANISATION_NAME: z.string().trim().min(2).max(120),
  BOOTSTRAP_ORGANISATION_SLUG: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(60),
});
const input = schema.parse(process.env);
const prisma = new PrismaClient();

try {
  const passwordHash = await hashPassword(input.BOOTSTRAP_OWNER_PASSWORD);
  await prisma.$transaction(async (tx) => {
    // Serialise bootstrap attempts so two concurrent CLI runs cannot create competing owners.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(781234567890)`;
    const existingOwner = await tx.organizationMembership.findFirst({
      where: { role: 'OWNER', isActive: true },
    });
    if (existingOwner) {
      throw new Error('An active organisation owner already exists; bootstrap is disabled.');
    }
    const user = await tx.user.create({
      data: {
        email: input.BOOTSTRAP_OWNER_EMAIL,
        passwordHash,
        displayName: input.BOOTSTRAP_OWNER_NAME,
      },
    });
    const organisation = await tx.organisation.create({
      data: {
        name: input.BOOTSTRAP_ORGANISATION_NAME,
        slug: input.BOOTSTRAP_ORGANISATION_SLUG,
      },
    });
    await tx.organizationMembership.create({
      data: { organisationId: organisation.id, userId: user.id, role: 'OWNER' },
    });
    await tx.auditLog.create({
      data: {
        organisationId: organisation.id,
        actorId: user.id,
        action: 'OWNER_BOOTSTRAPPED',
        resourceType: 'Organisation',
        resourceId: organisation.id,
      },
    });
  });
  process.stdout.write('MailForge owner and organisation created. Remove bootstrap credentials from the environment.\n');
} finally {
  await prisma.$disconnect();
}
