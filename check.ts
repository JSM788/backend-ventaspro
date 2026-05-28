import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const comprobantes = await prisma.comprobante.findMany();
  console.log('Comprobantes:', comprobantes);
}
main().catch(console.error).finally(() => prisma.$disconnect());
