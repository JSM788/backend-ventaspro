import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Inventario...');

  // 1. Obtener una empresa
  const empresa = await prisma.empresa.findFirst();
  if (!empresa) {
    console.error('No hay empresas en la BD.');
    return;
  }

  // 2. Crear Almacén Principal
  let almacen = await prisma.almacen.findFirst({ where: { empresaId: empresa.id, nombre: 'Almacén Principal' } });
  if (!almacen) {
    almacen = await prisma.almacen.create({
      data: {
        empresaId: empresa.id,
        nombre: 'Almacén Principal',
        direccion: 'Av. Los Ficticios 123',
        esPrincipal: true,
      }
    });
    console.log('Almacén Principal creado.');
  }

  // 3. Crear Almacén Secundario (Multi-almacén demo)
  let almacenSecundario = await prisma.almacen.findFirst({ where: { empresaId: empresa.id, nombre: 'Tienda Norte' } });
  if (!almacenSecundario) {
    almacenSecundario = await prisma.almacen.create({
      data: {
        empresaId: empresa.id,
        nombre: 'Tienda Norte',
        direccion: 'Calle Falsa 456',
        esPrincipal: false,
      }
    });
    console.log('Almacén Tienda Norte creado.');
  }

  // 4. Obtener algunos productos
  const productos = await prisma.producto.findMany({ take: 3 });

  // 5. Inyectar stock inicial (INGRESO_INICIAL) en Almacén Principal
  for (const prod of productos) {
    // Verificar si ya tiene movimientos
    const movs = await prisma.movimientoKardex.count({ where: { productoId: prod.id } });
    if (movs === 0) {
      const cantidadInicial = 100;
      await prisma.movimientoKardex.create({
        data: {
          almacenId: almacen.id,
          productoId: prod.id,
          tipoOperacion: 'INGRESO_INICIAL',
          cantidad: cantidadInicial,
          costoUnitario: Number(prod.precioUnitario) * 0.6, // Costo ficticio = 60% del precio
          saldoActual: cantidadInicial,
          origenTipo: 'SISTEMA',
          observacion: 'Carga inicial de inventario',
        }
      });
      // Actualizar caché de producto
      await prisma.producto.update({
        where: { id: prod.id },
        data: { stock: cantidadInicial }
      });
      console.log(`Stock inicial de 100 inyectado para producto: ${prod.nombre}`);
    }
  }

  console.log('Seed de Inventario completado.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
