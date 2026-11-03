import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as typeof globalThis & { mailforgePrisma?: PrismaClient };
export const prisma = globalForPrisma.mailforgePrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.mailforgePrisma = prisma;
