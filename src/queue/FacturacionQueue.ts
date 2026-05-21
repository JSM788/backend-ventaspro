import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export const FacturacionQueue = new Queue('cola-facturacion', { connection });
