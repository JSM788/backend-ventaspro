import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const empresa = await prisma.empresa.findFirst();
  if (!empresa) return;

  await prisma.cajaCuenta.create({
    data: {
      empresaId: empresa.id,
      nombre: 'Caja General (Efectivo)',
      tipo: 'EFECTIVO',
    }
  });

  await prisma.cajaCuenta.create({
    data: {
      empresaId: empresa.id,
      nombre: 'Cuenta BCP (Soles)',
      tipo: 'BANCO',
    }
  });

  await prisma.cajaCuenta.create({
    data: {
      empresaId: empresa.id,
      nombre: 'Yape / Plin',
      tipo: 'BILLETERA_DIGITAL',
    }
  });

  console.log('Cuentas creadas exitosamente');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
