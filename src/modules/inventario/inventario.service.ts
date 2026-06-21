import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';

export class RegistrarMovimientoDto {
  almacenId: string;
  productoId: number;
  tipoOperacion: string; // INGRESO_COMPRA, SALIDA_VENTA, MERMA, TRASLADO, INGRESO_INICIAL
  cantidad: number;
  costoUnitario?: number;
  origenId?: string;
  origenTipo?: string;
  observacion?: string;
  creadoPor?: string;
}

/**
 * Calcula el estado de stock de un producto basado en stock actual vs umbrales.
 */
export function calcularEstadoStock(
  stock: number,
  stockMinimo: number,
  stockMaximo: number,
): 'AGOTADO' | 'CRITICO' | 'BAJO_STOCK' | 'EXCESO' | 'NORMAL' {
  if (stock <= 0) return 'AGOTADO';
  if (stockMinimo > 0 && stock <= stockMinimo * 0.5) return 'CRITICO';
  if (stockMinimo > 0 && stock <= stockMinimo) return 'BAJO_STOCK';
  if (stockMaximo > 0 && stock > stockMaximo) return 'EXCESO';
  return 'NORMAL';
}

@Injectable()
export class InventarioService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Registra un movimiento en el Kardex y actualiza el stock caché del producto.
   * Utiliza una transacción para garantizar consistencia.
   */
  async registrarMovimiento(empresaId: string, data: RegistrarMovimientoDto, tx?: Prisma.TransactionClient) {
    const prismaClient = tx || this.prisma;

    return await prismaClient.$transaction(async (prismaTx) => {
      // 1. Validar Almacen y Producto
      const almacen = await prismaTx.almacen.findFirst({ where: { id: data.almacenId, empresaId } });
      if (!almacen) throw new BadRequestException(`Almacén no encontrado: ${data.almacenId}`);

      const producto = await prismaTx.producto.findFirst({ where: { id: data.productoId, empresaId } });
      if (!producto) throw new BadRequestException(`Producto no encontrado: ${data.productoId}`);

      // 2. Obtener el stock actual en ese almacén para calcular el saldo (Snapshot)
      const stockAlmacenAnterior = await prismaTx.stockAlmacen.findUnique({
        where: {
          productoId_almacenId: {
            productoId: data.productoId,
            almacenId: data.almacenId
          }
        }
      });

      const saldoAnterior = Number(stockAlmacenAnterior?.stock || 0);
      const nuevoSaldo = saldoAnterior + data.cantidad;

      // 3. Crear el movimiento
      const movimiento = await prismaTx.movimientoKardex.create({
        data: {
          almacenId: data.almacenId,
          productoId: data.productoId,
          tipoOperacion: data.tipoOperacion,
          cantidad: data.cantidad,
          costoUnitario: data.costoUnitario || producto.precioUnitario, // Fallback si no se envía costo
          saldoActual: nuevoSaldo,
          origenId: data.origenId,
          origenTipo: data.origenTipo,
          observacion: data.observacion,
          creadoPor: data.creadoPor,
        },
        include: {
          producto: { select: { nombre: true, codigoInterno: true, categoria: true, marca: true } },
          almacen: { select: { nombre: true, id: true } }
        }
      });

      // 4. Actualizar o crear el registro en StockAlmacen
      await prismaTx.stockAlmacen.upsert({
        where: {
          productoId_almacenId: {
            productoId: data.productoId,
            almacenId: data.almacenId
          }
        },
        update: {
          stock: nuevoSaldo
        },
        create: {
          empresaId,
          productoId: data.productoId,
          almacenId: data.almacenId,
          stock: nuevoSaldo
        }
      });

      // 5. Actualizar la caché global de stock en Producto (sumatoria de todos los almacenes)
      const stockTotalGlobal = await prismaTx.stockAlmacen.aggregate({
        _sum: { stock: true },
        where: { productoId: data.productoId }
      });

      await prismaTx.producto.update({
        where: { id: data.productoId },
        data: { stock: stockTotalGlobal._sum.stock || 0 }
      });

      return movimiento;
    });
  }

  /**
   * Obtiene el stock actual de un producto (puede ser filtrado por almacén)
   */
  async obtenerStock(empresaId: string, productoId: number, almacenId?: string) {
    if (almacenId) {
      const stockAlmacen = await this.prisma.stockAlmacen.findFirst({
        where: {
          empresaId,
          productoId,
          almacenId
        }
      });
      return Number(stockAlmacen?.stock || 0);
    } else {
      const producto = await this.prisma.producto.findFirst({
        where: { id: productoId, empresaId },
        select: { stock: true }
      });
      return Number(producto?.stock || 0);
    }
  }

  /**
   * Lista el stock de todos los productos. Si se envía almacenId, muestra el stock específico de ese almacén.
   * El campo `estadoStock` se calcula en base a stockMinimo y stockMaximo.
   */
  async listarStock(empresaId: string, almacenId?: string) {
    if (almacenId && almacenId !== 'undefined' && almacenId.trim() !== '') {
      const registros = await this.prisma.stockAlmacen.findMany({
        where: { almacenId, empresaId },
        include: {
          producto: {
            include: { categoria: true, marca: true }
          },
          almacen: true
        },
        orderBy: { producto: { nombre: 'asc' } }
      });

      return registros.map((r) => ({
        ...r,
        estadoStock: calcularEstadoStock(
          Number(r.stock),
          Number(r.stockMinimo),
          Number(r.stockMaximo),
        ),
      }));
    }

    const productos = await this.prisma.producto.findMany({
      where: { empresaId },
      include: {
        categoria: true,
        marca: true,
        stockAlmacenes: {
          include: { almacen: true }
        }
      },
      orderBy: { nombre: 'asc' }
    });

    return productos.map((p) => {
      const stockPrincipal = p.stockAlmacenes.find((sa) => sa.almacen?.['esPrincipal']) 
        ?? p.stockAlmacenes[0];
      const stockMinimo = Number(stockPrincipal?.stockMinimo ?? 0);
      const stockMaximo = Number(stockPrincipal?.stockMaximo ?? 0);

      return {
        ...p,
        estadoStock: calcularEstadoStock(Number(p.stock), stockMinimo, stockMaximo),
      };
    });
  }

  /**
   * Obtiene el historial (Kardex) de un producto
   */
  async obtenerKardex(empresaId: string, productoId: number, almacenId?: string) {
    const filter: any = {
      productoId,
      almacen: {
        empresaId
      }
    };
    if (almacenId && almacenId !== 'undefined' && almacenId.trim() !== '') filter.almacenId = almacenId;

    return await this.prisma.movimientoKardex.findMany({
      where: filter,
      orderBy: { fecha: 'desc' },
      include: {
        almacen: { select: { nombre: true, id: true } },
        producto: { select: { nombre: true, codigoInterno: true } }
      }
    });
  }

  /**
   * Obtiene todos los movimientos de Kardex para una empresa (opcional filtrado por almacen)
   */
  async listarMovimientos(empresaId: string, almacenId?: string) {
    const filter: any = {
      almacen: {
        empresaId
      }
    };
    if (almacenId && almacenId !== 'undefined' && almacenId.trim() !== '') filter.almacenId = almacenId;

    return await this.prisma.movimientoKardex.findMany({
      where: filter,
      orderBy: { fecha: 'desc' },
      include: {
        almacen: { select: { nombre: true, id: true } },
        producto: { select: { nombre: true, codigoInterno: true, categoria: true, marca: true } }
      }
    });
  }

  /**
   * Obtiene el resumen general del Kardex (todos los productos y su stock)
   */
  async obtenerResumenKardex(empresaId: string) {
    const productos = await this.prisma.producto.findMany({
      where: { empresaId },
      include: {
        categoria: true,
        stockAlmacenes: {
          orderBy: { almacen: { esPrincipal: 'desc' } },
          take: 1
        }
      },
      orderBy: { nombre: 'asc' }
    });

    return productos.map((p) => {
      const stockRef = p.stockAlmacenes[0];
      const stockMinimo = Number(stockRef?.stockMinimo ?? 0);
      const stockMaximo = Number(stockRef?.stockMaximo ?? 0);

      return {
        ...p,
        stockAlmacenes: undefined,
        estadoStock: calcularEstadoStock(Number(p.stock), stockMinimo, stockMaximo),
        stockMinimo,
        stockMaximo,
      };
    });
  }

  /**
   * Lista todos los traslados de la empresa
   */
  async listarTraslados(empresaId: string) {
    return await this.prisma.traslado.findMany({
      where: { empresaId },
      orderBy: { fechaEnvio: 'desc' },
      include: {
        almacenOrigen: { select: { nombre: true, id: true } },
        almacenDestino: { select: { nombre: true, id: true } },
        detalles: {
          include: {
            producto: { select: { nombre: true, codigoInterno: true, id: true } }
          }
        }
      }
    });
  }

  /**
   * Lista todos los almacenes de la empresa
   */
  async listarAlmacenes(empresaId: string) {
    return await this.prisma.almacen.findMany({
      where: { empresaId },
      orderBy: { nombre: 'asc' }
    });
  }

  /**
   * Crea un traslado en estado EN_TRANSITO
   */
  async crearTraslado(empresaId: string, data: import('./dto/crear-traslado.dto').CrearTrasladoDto) {
    if (data.almacenOrigenId === data.almacenDestinoId) {
      throw new BadRequestException('El almacén origen y destino no pueden ser el mismo');
    }

    if (!data.detalles || data.detalles.length === 0) {
      throw new BadRequestException('El traslado debe tener al menos un producto');
    }

    return await this.prisma.$transaction(async (prismaTx) => {
      // Generar número de traslado (ej. TR-00001)
      const count = await prismaTx.traslado.count({ where: { empresaId } });
      const numero = `TR-${(count + 1).toString().padStart(5, '0')}`;

      // Crear el registro de traslado
      const traslado = await prismaTx.traslado.create({
        data: {
          empresaId,
          numero,
          almacenOrigenId: data.almacenOrigenId,
          almacenDestinoId: data.almacenDestinoId,
          estado: 'EN_TRANSITO',
          observaciones: data.observaciones,
          responsableEnvioId: data.responsableEnvioId,
          detalles: {
            create: data.detalles.map(d => ({
              productoId: d.productoId,
              cantidadEnviada: d.cantidadEnviada
            }))
          }
        },
        include: {
          detalles: true
        }
      });

      // Nota: En un sistema real, aquí podríamos descontar el stock "Disponible" o pasarlo a un stock "En Tránsito".
      // Por ahora mantenemos la lógica simple requerida: el traslado es EN_TRANSITO y luego alguien debe recibirlo.

      return traslado;
    });
  }
}
