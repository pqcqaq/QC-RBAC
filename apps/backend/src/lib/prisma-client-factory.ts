import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './prisma-generated';

const resolveDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize Prisma');
  }

  return databaseUrl;
};

export const createPrismaAdapter = (databaseUrl = resolveDatabaseUrl()) =>
  new PrismaPg({ connectionString: databaseUrl });

export const createPrismaClient = (databaseUrl = resolveDatabaseUrl()) =>
  new PrismaClient({
    adapter: createPrismaAdapter(databaseUrl),
  });
