import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const isLocal = process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1');
let connectionString = process.env.DATABASE_URL;

if (connectionString && !isLocal) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('ssl');
    connectionString = url.toString();
  } catch (e) {
    // Ignorar error si no es una URL válida
  }
}

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);

// Se exporta la instancia de Prisma de forma independiente (Singleton)
// Esto es vital para que el Worker de BullMQ corra como un proceso aislado
// sin necesidad de levantar toda la aplicación de NestJS.
export const db = new PrismaClient({ adapter });
