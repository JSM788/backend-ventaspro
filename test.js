const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

require('dotenv').config();

async function test() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    let empresa = await prisma.empresa.findFirst();

    console.log("Testing listarStock sin almacenId...");
    await prisma.producto.findMany({
      where: { empresaId: empresa?.id },
      include: {
        categoria: true,
        marca: true,
        stockAlmacenes: {
          include: { almacen: true }
        }
      },
      orderBy: { nombre: 'asc' }
    });
    console.log("listarStock ok.");

    console.log("Testing listarMovimientos...");
    await prisma.movimientoKardex.findMany({
      where: { almacen: { empresaId: empresa?.id } },
      orderBy: { fecha: 'desc' },
      include: {
        almacen: { select: { nombre: true, id: true } },
        producto: { select: { nombre: true, codigoInterno: true, categoria: true, marca: true } }
      }
    });
    console.log("listarMovimientos ok.");

  } catch (e) {
    console.error("PRISMA ERROR:", e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
test();
