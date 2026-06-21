import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const comprobantes = await prisma.comprobante.findMany({
    select: {
      id: true,
      tipo: true,
      serie: true,
      correlativo: true,
      empresaId: true
    }
  });
  console.log("Comprobantes:", JSON.stringify(comprobantes, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
