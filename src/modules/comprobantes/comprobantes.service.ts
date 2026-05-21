import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { FacturacionQueue } from '../../queue/FacturacionQueue';
import { randomUUID } from 'crypto';

@Injectable()
export class ComprobantesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.comprobante.findMany({
      include: { cliente: true },
      orderBy: { fechaEmision: 'desc' },
    });
  }

  async getSummary() {
    const comprobantes = await this.prisma.comprobante.findMany();
    
    const facturas = comprobantes
      .filter(c => c.tipo === '01' || c.tipo === 'factura')
      .reduce((sum, c) => sum + Number(c.total), 0);
    const boletas = comprobantes
      .filter(c => c.tipo === '03' || c.tipo === 'boleta')
      .reduce((sum, c) => sum + Number(c.total), 0);
    const notasCredito = comprobantes
      .filter(c => c.tipo === '07' || c.tipo === 'nota_credito')
      .reduce((sum, c) => sum + Number(c.total), 0);
    const notasDebito = comprobantes
      .filter(c => c.tipo === '08' || c.tipo === 'nota_debito')
      .reduce((sum, c) => sum + Number(c.total), 0);
    
    const saldo = comprobantes.reduce((sum, c) => sum + Number(c.total), 0);
    const total = facturas + boletas + notasDebito - notasCredito;

    return {
      total,
      facturas,
      boletas,
      notasCredito,
      notasDebito,
      saldo,
      count: comprobantes.length
    };
  }

  async create(data: any) {
    // IMPORTANTE: En un entorno real, el EmpresaId viene del usuario logueado (JWT)
    // Como estamos en desarrollo, creamos/buscamos una empresa inicial
    let empresa = await this.prisma.empresa.findFirst();
    if (!empresa) {
      empresa = await this.prisma.empresa.create({
        data: { ruc: "20123456789", razonSocial: "Empresa de Prueba" }
      });
    }

    // 1. Iniciar Transacción ($transaction) para asegurar el correlativo
    const result = await this.prisma.$transaction(async (tx) => {
      // a. Bloquear / Consultar la configuración de la serie
      let serieConfig = await tx.serieConfig.findUnique({
        where: {
          empresaId_serie: {
            empresaId: empresa.id,
            serie: data.serie
          }
        }
      });

      // Si es la primera vez que se usa esta serie, la creamos desde cero
      if (!serieConfig) {
        serieConfig = await tx.serieConfig.create({
          data: {
            empresaId: empresa.id,
            tipoComprobante: data.tipo,
            serie: data.serie,
            ultimoCorrelativo: 0
          }
        });
      }

      // b. Calculamos el nuevo correlativo seguro
      const nuevoCorrelativo = serieConfig.ultimoCorrelativo + 1;
      const transaccionId = randomUUID();

      // c. Guardamos el comprobante y sus detalles juntos (Nested Writes)
      const nuevoComprobante = await tx.comprobante.create({
        data: {
          empresaId: empresa.id,
          transaccionId,
          tipo: data.tipo,
          serie: data.serie,
          correlativo: nuevoCorrelativo,
          fechaEmision: new Date(data.fechaEmision),
          clienteId: data.clienteId,
          moneda: data.moneda,
          operacionGravada: data.operacionGravada,
          igv: data.igv,
          total: data.total,
          estadoSunat: 'PENDIENTE',
          viaEmision: 'NATIVO',
          detalles: {
            create: data.detalles.map((d: any) => ({
              descripcion: d.descripcion,
              cantidad: d.cantidad,
              precioUnitario: d.precioUnitario,
              valorUnitario: d.valorUnitario,
              igv: (d.cantidad * d.precioUnitario) - (d.cantidad * d.valorUnitario),
              subtotal: d.cantidad * d.valorUnitario,
              total: d.cantidad * d.precioUnitario
            }))
          }
        }
      });

      // d. Actualizamos el registro de correlativos
      await tx.serieConfig.update({
        where: { id: serieConfig.id },
        data: { ultimoCorrelativo: nuevoCorrelativo }
      });

      return nuevoComprobante;
    });

    // 2. Empujar el Trabajo a la Cola BullMQ
    // Esto despierta al FacturacionWorker para que mande el XML
    await FacturacionQueue.add('emitir-comprobante', {
      comprobanteId: result.id
    }, {
      attempts: 3, // Reintentar 3 veces si la SUNAT está caída
      backoff: { type: 'exponential', delay: 2000 } // Esperar 2s, 4s, 8s entre intentos
    });

    return result;
  }
}
