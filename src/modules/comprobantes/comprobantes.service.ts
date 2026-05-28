import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { InventarioService } from '../inventario/inventario.service';
import { FacturacionQueue } from '../../pse/queues/FacturacionQueue';
import { randomUUID } from 'crypto';
import { TIPOS_COMPROBANTE, ESTADOS_SUNAT, CONDICIONES_PAGO, ESTADOS_PAGO } from '../../core/constants';

@Injectable()
export class ComprobantesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventarioService: InventarioService
  ) {}

  private buildWhereClause(filters: any) {
    const where: any = {};
    if (filters.search) {
      const searchNum = parseInt(filters.search, 10);
      where.OR = [
        { cliente: { razonSocial: { contains: filters.search, mode: 'insensitive' } } },
        { cliente: { ruc: { contains: filters.search } } }
      ];
      if (!isNaN(searchNum)) {
        where.OR.push({ correlativo: searchNum });
      }
    }
    if (filters.estado && filters.estado.toUpperCase() !== 'TODOS') {
      where.estadoSunat = filters.estado.toUpperCase();
    }
    if (filters.serie && filters.serie.toUpperCase() !== 'TODAS') {
      where.serie = filters.serie;
    }
    if (filters.fechaInicio && filters.fechaFin) {
      const startDate = new Date(filters.fechaInicio);
      const endDate = new Date(filters.fechaFin);
      // Para incluir todo el último día hasta las 23:59:59
      endDate.setUTCHours(23, 59, 59, 999);
      
      where.fechaEmision = {
        gte: startDate,
        lte: endDate
      };
    }
    if (filters.tipo) {
      if (Array.isArray(filters.tipo)) {
        where.tipo = { in: filters.tipo };
      } else {
        where.tipo = filters.tipo;
      }
    }
    return where;
  }

  async findAll(filters: any) {
    const { page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(filters);

    const [data, total] = await Promise.all([
      this.prisma.comprobante.findMany({
        where,
        include: { cliente: true, cuotas: true },
        orderBy: [
          { fechaEmision: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit,
      }),
      this.prisma.comprobante.count({ where })
    ]);

    const mappedData = data.map((comp: any) => {
      let saldo = 0;
      if (comp.condicionPago === 'CREDITO' && comp.cuotas && comp.cuotas.length > 0) {
        saldo = comp.cuotas.reduce((sum: number, cuota: any) => sum + (Number(cuota.monto) - Number(cuota.montoPagado)), 0);
      }
      return { ...comp, saldo };
    });

    return {
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getSummary(filters: any) {
    const where = this.buildWhereClause(filters);
    const comprobantes = await this.prisma.comprobante.findMany({ where });
    
    const facturas = comprobantes
      .filter(c => c.tipo === TIPOS_COMPROBANTE.FACTURA || c.tipo === 'factura')
      .reduce((sum, c) => sum + Number(c.total), 0);
    const boletas = comprobantes
      .filter(c => c.tipo === TIPOS_COMPROBANTE.BOLETA || c.tipo === 'boleta')
      .reduce((sum, c) => sum + Number(c.total), 0);
    const notasCredito = comprobantes
      .filter(c => c.tipo === TIPOS_COMPROBANTE.NOTA_CREDITO || c.tipo === 'nota_credito')
      .reduce((sum, c) => sum + Number(c.total), 0);
    const notasDebito = comprobantes
      .filter(c => c.tipo === TIPOS_COMPROBANTE.NOTA_DEBITO || c.tipo === 'nota_debito')
      .reduce((sum, c) => sum + Number(c.total), 0);
    const notasVenta = comprobantes
      .filter(c => c.tipo === TIPOS_COMPROBANTE.NOTA_VENTA || c.tipo === 'nota_venta')
      .reduce((sum, c) => sum + Number(c.total), 0);
    
    const saldo = comprobantes.reduce((sum, c) => sum + Number(c.total), 0);
    const total = facturas + boletas + notasDebito - notasCredito;

    return {
      total,
      facturas,
      boletas,
      notasCredito,
      notasDebito,
      notasVenta,
      saldo,
      count: comprobantes.length
    };
  }

  async create(empresaId: string, data: any) {
    let empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) {
      throw new BadRequestException('Empresa no encontrada');
    }

    // Bloquear si no hay certificado (y no es nota de venta)
    if (data.tipo !== TIPOS_COMPROBANTE.NOTA_VENTA && data.tipo !== 'NV') {
      if (!empresa.certificadoBase64) {
        throw new BadRequestException('No cuentas con un certificado digital configurado. Sube tu archivo .p12 en la Configuración de Empresa para emitir facturas y boletas.');
      }
    }

    // Buscar o crear el cliente al vuelo usando el RUC enviado desde el frontend
    let cliente = await this.prisma.cliente.findUnique({ where: { empresaId_ruc: { empresaId: empresa.id, ruc: data.clienteRuc } } });
    if (!cliente) {
      // Si la base de datos está vacía, asegurarnos de que exista un Tipo de Cliente
      let tipoCliente = await this.prisma.tipoCliente.findFirst({ where: { empresaId: empresa.id } });
      if (!tipoCliente) {
        tipoCliente = await this.prisma.tipoCliente.create({
          data: { nombre: 'General', descripcion: 'Tipo de cliente por defecto', empresaId: empresa.id }
        });
      }

      cliente = await this.prisma.cliente.create({
        data: {
          ruc: data.clienteRuc,
          razonSocial: data.clienteNombre || "Cliente sin nombre",
          tipoClienteId: tipoCliente.id,
          empresaId: empresa.id
        }
      });
    } else if (data.clienteNombre && cliente.razonSocial !== data.clienteNombre) {
      // AUTO-ACTUALIZACIÓN: Si el cajero corrigió el nombre en el carrito, actualizamos la BD
      cliente = await this.prisma.cliente.update({
        where: { id: cliente.id },
        data: { razonSocial: data.clienteNombre }
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
          clienteId: cliente.id,
          moneda: data.moneda,
          operacionGravada: data.operacionGravada,
          igv: data.igv,
          total: data.total,
          estadoSunat: ESTADOS_SUNAT.PENDIENTE,
          viaEmision: 'NATIVO',
          condicionPago: data.condicionPago || CONDICIONES_PAGO.CONTADO,
          estadoPago: data.condicionPago === CONDICIONES_PAGO.CREDITO ? ESTADOS_PAGO.PENDIENTE : ESTADOS_PAGO.PAGADO,
          cuotas: data.condicionPago === CONDICIONES_PAGO.CREDITO ? {
            create: [{
              numero: 1,
              fechaVencimiento: new Date(data.fechaVencimiento || data.fechaEmision),
              monto: data.total,
              estado: ESTADOS_PAGO.PENDIENTE
            }]
          } : undefined,
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

      // e. Descontar Inventario (Kardex Inmutable) si hay productoId
      // El almacén se debe sacar de la sesión/sucursal, usamos uno por defecto de la empresa por ahora
      const almacenDefecto = await tx.almacen.findFirst({ where: { empresaId: empresa.id } });
      if (almacenDefecto) {
        for (const det of data.detalles) {
          if (det.productoId) {
            await this.inventarioService.registrarMovimiento({
              almacenId: almacenDefecto.id,
              productoId: Number(det.productoId),
              tipoOperacion: 'SALIDA_VENTA',
              cantidad: -Math.abs(Number(det.cantidad)), // Salida es negativo
              costoUnitario: Number(det.valorUnitario), // Idealmente usamos el costo de compra, por ahora valor unitario
              origenId: nuevoComprobante.id,
              origenTipo: 'FACTURA',
              observacion: `Venta con ${data.serie}-${nuevoCorrelativo}`
            }, tx);
          }
        }
      }

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

  async consolidar(data: { empresaId: string, notasVentaIds: string[], clienteId: number, tipoComprobante: string, serie: string }) {
    let empresa = await this.prisma.empresa.findUnique({ where: { id: data.empresaId } });
    if (!empresa?.certificadoBase64 && data.tipoComprobante !== 'NV') {
      throw new BadRequestException('No cuentas con un certificado digital configurado. Sube tu archivo .p12 en la Configuración de Empresa para consolidar en facturas o boletas.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Obtener Notas de Venta a consolidar
      const notas = await tx.comprobante.findMany({
        where: {
          id: { in: data.notasVentaIds },
          empresaId: data.empresaId, // Filtro multitenant
          tipo: 'NV',
        },
        include: {
          detalles: true
        }
      });

      if (notas.length === 0) {
        throw new BadRequestException('No se encontraron Notas de Venta válidas para consolidar');
      }

      // 2. Consolidar totales y detalles
      let totalGravada = 0;
      let totalIgv = 0;
      let montoTotal = 0;
      const detallesConsolidados: any[] = [];

      for (const nota of notas) {
        totalGravada += Number(nota.operacionGravada);
        totalIgv += Number(nota.igv);
        montoTotal += Number(nota.total);

        // Opcional: Podríamos agrupar detalles por producto si queremos, o simplemente juntarlos todos.
        for (const det of nota.detalles) {
          detallesConsolidados.push({
            descripcion: det.descripcion,
            cantidad: Number(det.cantidad),
            precioUnitario: Number(det.precioUnitario),
            valorUnitario: Number(det.valorUnitario),
            igv: Number(det.igv),
            subtotal: Number(det.subtotal),
            total: Number(det.total)
          });
        }
      }

      const empresaId = data.empresaId; // Obtenido directamente del request guardado en jwt

      // 3. Generar Correlativo para Factura/Boleta
      let serieConfig = await tx.serieConfig.findUnique({
        where: { empresaId_serie: { empresaId, serie: data.serie } }
      });

      if (!serieConfig) {
        serieConfig = await tx.serieConfig.create({
          data: { empresaId, tipoComprobante: data.tipoComprobante, serie: data.serie, ultimoCorrelativo: 0 }
        });
      }
      const nuevoCorrelativo = serieConfig.ultimoCorrelativo + 1;
      const transaccionId = randomUUID();

      // 4. Crear el comprobante consolidado
      const nuevoComprobante = await tx.comprobante.create({
        data: {
          empresaId,
          transaccionId,
          tipo: data.tipoComprobante,
          serie: data.serie,
          correlativo: nuevoCorrelativo,
          fechaEmision: new Date(),
          clienteId: data.clienteId,
          moneda: 'PEN',
          operacionGravada: totalGravada,
          igv: totalIgv,
          total: montoTotal,
          estadoSunat: 'PENDIENTE',
          viaEmision: 'NATIVO',
          condicionPago: 'CONTADO',
          estadoPago: 'PAGADO', // Si consolida, asumimos que generará sus pagos luego
          detalles: {
            create: detallesConsolidados
          },
          comprobantesOrigen: {
            create: notas.map(n => ({
              origenId: n.id,
              tipoRelacion: 'CONSOLIDACION',
              montoAsignado: n.total
            }))
          }
        }
      });

      // 5. Actualizar correlativo
      await tx.serieConfig.update({
        where: { id: serieConfig.id },
        data: { ultimoCorrelativo: nuevoCorrelativo }
      });

      // 6. Marcar las Notas de Venta como Facturadas (cambiando su estado interno si lo tuviéramos)
      // Como no tenemos campo estado Venta, podríamos usar observaciones o simplemente confiar en la relación
      await tx.comprobante.updateMany({
        where: { id: { in: data.notasVentaIds } },
        data: {
          observaciones: `CONSOLIDADO EN ${data.serie}-${nuevoCorrelativo}`
        }
      });

      // Queue Facturación
      await FacturacionQueue.add('emitir-comprobante', { comprobanteId: nuevoComprobante.id }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });

      return nuevoComprobante;
    });
  }
}
