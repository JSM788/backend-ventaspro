import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { InventarioService } from '../inventario/inventario.service';

@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventarioService: InventarioService
  ) {}

  /**
   * Obtener todas las Órdenes de Compra
   */
  async findAll() {
    return await this.prisma.ordenCompra.findMany({
      include: {
        proveedor: true,
        detalles: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Recibir Mercadería de una Orden de Compra.
   * Esto ingresa stock al inventario y recalcula el Kardex.
   */
  async recibirOrden(ordenCompraId: string, almacenId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const orden = await tx.ordenCompra.findUnique({
        where: { id: ordenCompraId },
        include: { detalles: true }
      });

      if (!orden) throw new BadRequestException('Orden de compra no encontrada');
      if (orden.estado === 'RECIBIDO' || orden.estado === 'FACTURADO') {
        throw new BadRequestException('La orden ya fue recibida o facturada');
      }

      // 1. Ingresar mercadería al Kardex por cada detalle
      for (const det of orden.detalles) {
        if (det.productoId) {
          await this.inventarioService.registrarMovimiento({
            almacenId,
            productoId: Number(det.productoId),
            tipoOperacion: 'INGRESO_COMPRA',
            cantidad: Number(det.cantidad), // Ingreso es positivo
            costoUnitario: Number(det.precioUnitario), // El costo real de la orden de compra
            origenId: orden.id,
            origenTipo: 'ORDEN_COMPRA',
            observacion: `Recepción de OC ${orden.numero}`
          }, tx);
        }
        
        // Actualizar cantidades recibidas en la orden
        await tx.ordenCompraDetalle.update({
          where: { id: det.id },
          data: { cantidadRecibida: det.cantidad }
        });
      }

      // 2. Actualizar estado de la Orden a RECIBIDO
      const ordenActualizada = await tx.ordenCompra.update({
        where: { id: orden.id },
        data: { estado: 'RECIBIDO' }
      });

      return ordenActualizada;
    });
  }
}
