import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const isLocal = process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);

// Se exporta la instancia de Prisma de forma independiente (Singleton)
// Esto es vital para que el Worker de BullMQ corra como un proceso aislado
// sin necesidad de levantar toda la aplicación de NestJS.
export const db = new PrismaClient({ adapter });
