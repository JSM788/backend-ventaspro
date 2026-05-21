import { PrismaClient } from '@prisma/client';

// Se exporta la instancia de Prisma de forma independiente (Singleton)
// Esto es vital para que el Worker de BullMQ corra como un proceso aislado
// sin necesidad de levantar toda la aplicación de NestJS.
export const db = new PrismaClient();
