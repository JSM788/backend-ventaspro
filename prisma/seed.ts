import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Iniciando Seed Maestro...');

  // 1. Inyectar Super Admin (Mock Auth)
  const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'admin@factupro.com';
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'admin';

  let superAdmin = await prisma.usuarioErp.findFirst({
    where: { isSuperAdmin: true }
  });

  if (!superAdmin) {
    superAdmin = await prisma.usuarioErp.create({
      data: {
        authUserId: 'superadmin-mock-id',
        email: superAdminEmail,
        password: superAdminPassword,
        isSuperAdmin: true,
      }
    });
    }
    console.log(`✅ Super Admin verificado: ${superAdmin.email}`);

    // 2. Inyectar Planes SaaS
    const planes = [
      { nombre: 'EMPRENDE', precioMensual: 24.9, precioAnual: 348, limiteFacturas: 200, limiteUsuarios: 1, limiteSucursales: 1, limiteProductos: 99999 },
      { nombre: 'NEGOCIO', precioMensual: 42.0, precioAnual: 588, limiteFacturas: 700, limiteUsuarios: 6, limiteSucursales: 3, limiteProductos: 99999 },
      { nombre: 'CONTROL', precioMensual: 59.1, precioAnual: 828, limiteFacturas: 1200, limiteUsuarios: 12, limiteSucursales: 5, limiteProductos: 99999 },
      { nombre: 'PREMIUM', precioMensual: 84.9, precioAnual: 1188, limiteFacturas: 2500, limiteUsuarios: 999, limiteSucursales: 999, limiteProductos: 99999 },
    ];

    for (const p of planes) {
      await prisma.plan.upsert({
        where: { nombre: p.nombre },
        update: {
          precioMensual: p.precioMensual,
          precioAnual: p.precioAnual,
          limiteFacturas: p.limiteFacturas,
          limiteUsuarios: p.limiteUsuarios,
          limiteSucursales: p.limiteSucursales
        },
        create: p,
      });
    }
    console.log(`✅ Planes SaaS inyectados (EMPRENDE, NEGOCIO, CONTROL, PREMIUM)`);

    // 3. Inyectar Tipos de Negocio
    const negocios = [
      { codigo: 'BODEGA', nombre: 'Bodega / Minimarket' },
      { codigo: 'FARMACIA', nombre: 'Farmacia / Botica' },
      { codigo: 'RESTAURANTE', nombre: 'Restaurante / Cafetería' },
      { codigo: 'SERVICIOS', nombre: 'Empresa de Servicios' },
      { codigo: 'RETAIL', nombre: 'Comercio Retail' },
    ];

    for (const n of negocios) {
      await prisma.tipoNegocio.upsert({
        where: { codigo: n.codigo },
        update: {},
        create: n,
      });
    }
    console.log(`✅ Tipos de Negocio inyectados`);

    // 4. Inyectar Módulos
    const modulos = [
      { codigo: 'POS', nombre: 'Punto de Venta' },
      { codigo: 'INVENTARIO', nombre: 'Control de Inventario Avanzado' },
      { codigo: 'FINANZAS', nombre: 'Finanzas y Bancos' },
      { codigo: 'COMPRAS', nombre: 'Compras y Proveedores' },
    ];

    for (const m of modulos) {
      await prisma.modulo.upsert({
        where: { codigo: m.codigo },
        update: {},
        create: m,
      });
    }
    console.log(`✅ Módulos base inyectados`);
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
