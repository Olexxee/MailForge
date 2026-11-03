import { prisma } from '../../lib/prisma.js';

export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email }, include: { memberships: { include: { organisation: true } } } });

export const findUserById = (id: string) =>
  prisma.user.findUnique({ where: { id }, include: { memberships: { include: { organisation: true } } } });

export const createSession = (input: { userId: string; tokenHash: string; csrfTokenHash: string; expiresAt: Date; absoluteExpiresAt: Date }) =>
  prisma.session.create({ data: input });

export const findActiveSession = (tokenHash: string, now = new Date()) =>
  prisma.session.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now }, user: { isActive: true } },
    include: { user: { include: { memberships: { include: { organisation: true } } } } },
  });

export const revokeSession = (id: string, now = new Date()) =>
  prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });

export const rotateSession = async (input: {
  oldSessionId: string; userId: string; tokenHash: string; csrfTokenHash: string; expiresAt: Date; absoluteExpiresAt: Date;
}) => prisma.$transaction(async (tx) => {
  const revoked = await tx.session.updateMany({
    where: { id: input.oldSessionId, userId: input.userId, revokedAt: null, expiresAt: { gt: new Date() }, absoluteExpiresAt: { gt: new Date() } },
    data: { revokedAt: new Date() },
  });
  if (revoked.count !== 1) return null;
  return tx.session.create({
    data: {
      userId: input.userId,
      tokenHash: input.tokenHash,
      csrfTokenHash: input.csrfTokenHash,
      expiresAt: input.expiresAt,
    },
  });
});
