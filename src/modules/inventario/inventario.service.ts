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

@Injectable()
export class InventarioService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un movimiento en el Kardex y actualiza el stock caché del producto.
   * Utiliza una transacción para garantizar consistencia.
   */
  async registrarMovimiento(data: RegistrarMovimientoDto, tx?: Prisma.TransactionClient) {
    const prismaClient = tx || this.prisma;

    return await prismaClient.$transaction(async (prismaTx) => {
      // 1. Validar Almacen y Producto
      const almacen = await prismaTx.almacen.findUnique({ where: { id: data.almacenId } });
      if (!almacen) throw new BadRequestException(`Almacén no encontrado: ${data.almacenId}`);

      const producto = await prismaTx.producto.findUnique({ where: { id: data.productoId } });
      if (!producto) throw new BadRequestException(`Producto no encontrado: ${data.productoId}`);

      // 2. Determinar cantidad real y calcular nuevo saldo snapshot
      // Calculamos el saldo obteniendo la suma histórica del kardex para este almacén y producto
      const historial = await prismaTx.movimientoKardex.aggregate({
        _sum: { cantidad: true },
        where: {
          almacenId: data.almacenId,
          productoId: data.productoId,
        }
      });

      const saldoAnterior = Number(historial._sum.cantidad || 0);
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
        }
      });

      // 4. Actualizar la caché global de stock en Producto (sumatoria de todos los almacenes)
      const stockTotalGlobal = await prismaTx.movimientoKardex.aggregate({
        _sum: { cantidad: true },
        where: { productoId: data.productoId }
      });
      
      await prismaTx.producto.update({
        where: { id: data.productoId },
        data: { stock: stockTotalGlobal._sum.cantidad || 0 }
      });

      return movimiento;
    });
  }

  /**
   * Obtiene el stock actual de un producto (puede ser filtrado por almacén)
   */
  async obtenerStock(productoId: number, almacenId?: string) {
    const filter: any = { productoId };
    if (almacenId) filter.almacenId = almacenId;

    const aggregate = await this.prisma.movimientoKardex.aggregate({
      _sum: { cantidad: true },
      where: filter
    });

    return Number(aggregate._sum.cantidad || 0);
  }

  /**
   * Obtiene el historial (Kardex) de un producto
   */
  async obtenerKardex(productoId: number, almacenId?: string) {
    const filter: any = { productoId };
    if (almacenId) filter.almacenId = almacenId;

    return await this.prisma.movimientoKardex.findMany({
      where: filter,
      orderBy: { fecha: 'desc' },
      include: {
        almacen: { select: { nombre: true } }
      }
    });
  }

  /**
   * Obtiene el resumen general del Kardex (todos los productos y su stock)
   */
  async obtenerResumenKardex() {
    return await this.prisma.producto.findMany({
      include: {
        categoria: true
      },
      orderBy: { nombre: 'asc' }
    });
  }
}
