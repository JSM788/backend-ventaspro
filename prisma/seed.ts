import { PrismaClient, EstadoSunat } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Iniciando Seed Maestro (Todo el Módulo de Ventas)...');

  // 1. Empresa Principal
  const empresaPrueba = await prisma.empresa.upsert({
    where: { ruc: '20123456789' },
    update: {},
    create: {
      ruc: '20123456789',
      razonSocial: 'Empresa Principal Seed S.A.C.',
      slug: 'empresa-seed'
    }
  });

  const empresaId = empresaPrueba.id;

  // 1. Tipos de Cliente
  const tipoGeneral = await prisma.tipoCliente.upsert({
    where: { nombre: 'General' },
    update: {},
    create: { nombre: 'General', empresaId }
  });

  // 2. Clientes
  const clienteBPM = await prisma.cliente.upsert({
    where: { empresaId_ruc: { empresaId, ruc: '20603415273' } },
    update: {},
    create: {
      empresaId,
      razonSocial: 'BPM INDUSTRIAL S.A.C.',
      ruc: '20603415273',
      tipoClienteId: tipoGeneral.id,
      estado: 'ACTIVO'
    }
  });

  const clientePrueba = await prisma.cliente.upsert({
    where: { empresaId_ruc: { empresaId, ruc: '20512345678' } },
    update: {},
    create: {
      empresaId,
      razonSocial: 'Empresa de Prueba S.A.C.',
      ruc: '20512345678',
      tipoClienteId: tipoGeneral.id,
      estado: 'ACTIVO'
    }
  });

  // 3. Comprobantes (Boletas y Facturas)
  console.log('📄 Insertando Comprobantes...');
  const comprobantes = [
    {
      empresaId,
      tipo: '01',
      serie: 'F001',
      correlativo: 1,
      transaccionId: 'seed-f001-1',
      clienteId: clienteBPM.id,
      moneda: 'PEN',
      total: 1500.50,
      estadoSunat: EstadoSunat.ACEPTADO
    },
    {
      empresaId,
      tipo: '03',
      serie: 'B001',
      correlativo: 1,
      transaccionId: 'seed-b001-1',
      clienteId: clienteBPM.id,
      moneda: 'PEN',
      total: 85.00,
      estadoSunat: EstadoSunat.PENDIENTE
    },
    {
      empresaId,
      tipo: 'NV',
      serie: 'NV01',
      correlativo: 100,
      transaccionId: 'seed-nv01-100',
      clienteId: clienteBPM.id,
      moneda: 'PEN',
      total: 1250.50,
      estadoSunat: EstadoSunat.PENDIENTE,
      estadoPago: 'PAGADO',
      vendedor: 'Administrador',
      observaciones: 'Venta directa de almacén'
    }
  ];

  for (const comp of comprobantes) {
    await prisma.comprobante.upsert({
      where: {
        empresaId_serie_correlativo_tipo: {
          empresaId: comp.empresaId,
          serie: comp.serie,
          correlativo: comp.correlativo,
          tipo: comp.tipo
        }
      },
      update: {},
      create: comp,
    });

    // Asegurarse de que el SerieConfig exista con el correlativo actualizado
    await prisma.serieConfig.upsert({
      where: {
        empresaId_serie: {
          empresaId: comp.empresaId,
          serie: comp.serie
        }
      },
      update: {
        ultimoCorrelativo: comp.correlativo
      },
      create: {
        empresaId: comp.empresaId,
        tipoComprobante: comp.tipo,
        serie: comp.serie,
        ultimoCorrelativo: comp.correlativo
      }
    });
  }

  // 4. Notas de Venta (ahora consolidadas en Comprobantes)
  // Las insertamos arriba en el arreglo de comprobantes.

  // 5. Cotizaciones
  console.log('💰 Insertando Cotizaciones...');
  const cotizaciones = [
    {
      empresaId,
      numero: "CT01-3",
      clienteId: clienteBPM.id,
      moneda: "PEN",
      total: 165.06,
      estado: "REGISTRADO",
      entrega: "Sin estado",
      vendedor: "Administrador",
      registradoPor: "Administrador"
    },
    {
      empresaId,
      numero: "CT01-2",
      clienteId: clienteBPM.id,
      moneda: "PEN",
      total: 165.06,
      estado: "REGISTRADO",
      entrega: "Sin estado",
      vendedor: "Administrador",
      registradoPor: "Administrador"
    },
    {
      empresaId,
      numero: "COT-6",
      clienteId: clienteBPM.id,
      moneda: "PEN",
      total: 249.00,
      estado: "ACEPTADO",
      entrega: "Sin estado",
      vendedor: "Administrador",
      registradoPor: "Administrador"
    },
    {
      empresaId,
      numero: "COT-3",
      clienteId: clienteBPM.id,
      moneda: "PEN",
      total: 89.00,
      estado: "ANULADO",
      entrega: "Sin estado",
      vendedor: "Administrador",
      registradoPor: "Administrador",
      notasVenta: "NV01-5"
    }
  ];

  for (const cot of cotizaciones) {
    await prisma.cotizacion.upsert({
      where: { numero: cot.numero },
      update: {},
      create: cot,
    });
  }

  // 6. Pedidos
  console.log('📦 Insertando Pedidos...');
  const pedidos = [
    {
      empresaId,
      numero: "PD-3",
      clienteId: clienteBPM.id,
      moneda: "PEN",
      total: 21.98,
      estado: "ENTREGADO",
      vendedor: "Administrador",
      fechaEntrega: new Date("2026-04-10")
    },
    {
      empresaId,
      numero: "PD-2",
      clienteId: clienteBPM.id,
      moneda: "PEN",
      total: 12.00,
      estado: "ENTREGADO",
      vendedor: "Administrador",
      notasVenta: "NV01-16",
      fechaEntrega: new Date("2026-04-04")
    },
    {
      empresaId,
      numero: "PD-1",
      clienteId: clienteBPM.id,
      moneda: "PEN",
      total: 22.51,
      estado: "PENDIENTE",
      vendedor: "Administrador",
      comprobantes: "BO01-13",
      fechaEntrega: new Date("2026-03-24")
    }
  ];

  for (const ped of pedidos) {
    await prisma.pedido.upsert({
      where: { numero: ped.numero },
      update: {},
      create: ped,
    });
  }

  console.log('✅ Seed Maestro finalizado con éxito para todas las pestañas.');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
