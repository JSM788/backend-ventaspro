import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateDevolucionProveedorDto } from './dto/create-devolucion.dto';

@Injectable()
export class DevolucionesProveedorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, createDto: CreateDevolucionProveedorDto) {
    if (!createDto.detalles || createDto.detalles.length === 0) {
      throw new BadRequestException('La devolución debe tener al menos un producto');
    }

    return await this.prisma.$transaction(async (prismaTx) => {
      // 2. Generar número correlativo (ej. DP-00001)
      const count = await prismaTx.devolucionProveedor.count({ where: { empresaId } });
      const numero = `DP-${(count + 1).toString().padStart(5, '0')}`;

      // 3. Calcular el monto total de la devolución
      const montoTotalAfectado = createDto.detalles.reduce((acc, curr) => {
        return acc + (curr.cantidad * curr.precioCompra);
      }, 0);

      // 4. Crear el documento de devolución
      const devolucion = await prismaTx.devolucionProveedor.create({
        data: {
          empresaId,
          numero,
          proveedorId: createDto.proveedorId,
          almacenId: createDto.almacenId,
          motivo: createDto.motivo,
          observaciones: createDto.observaciones,
          montoTotalAfectado,
          estado: 'REGISTRADA',
          detalles: {
            create: createDto.detalles.map((d) => ({
              productoId: d.productoId,
              cantidad: d.cantidad,
              precioCompra: d.precioCompra,
            })),
          },
        },
        include: {
          detalles: true,
        },
      });

      // 5. Generar salidas en el Kardex y descontar Stock para cada producto
      for (const detalle of createDto.detalles) {
        const producto = await prismaTx.producto.findUnique({ where: { id: detalle.productoId } });
        if (!producto) throw new BadRequestException(`Producto no encontrado: ${detalle.productoId}`);

        // a) Obtener stock anterior para saldo actual
        const stockAlmacen = await prismaTx.stockAlmacen.findUnique({
          where: {
            productoId_almacenId: {
              productoId: detalle.productoId,
              almacenId: createDto.almacenId,
            },
          },
        });

        const saldoAnterior = Number(stockAlmacen?.stock || 0);
        // Descontamos porque es una devolución (salida del almacén)
        const nuevoSaldo = saldoAnterior - detalle.cantidad;

        if (nuevoSaldo < 0) {
          throw new BadRequestException(
            `Stock insuficiente para el producto ${producto.nombre} en este almacén para realizar la devolución.`
          );
        }

        // b) Registrar en el kardex (SALIDA_DEVOLUCION_PROVEEDOR)
        // Guardar la cantidad descontada como negativo (convención)
        await prismaTx.movimientoKardex.create({
          data: {
            almacenId: createDto.almacenId,
            productoId: detalle.productoId,
            tipoOperacion: 'SALIDA_DEVOLUCION_PROVEEDOR',
            cantidad: -detalle.cantidad, // Convención: salidas son negativas en cantidad para facilitar suma
            costoUnitario: detalle.precioCompra,
            saldoActual: nuevoSaldo,
            origenId: devolucion.id,
            origenTipo: 'DEVOLUCION_PROVEEDOR',
            observacion: `Devolución a proveedor: ${numero} - ${createDto.motivo}`,
            // creadoPor se dejaría en null si no tenemos al user en contexto
          },
        });

        // c) Actualizar StockAlmacen
        await prismaTx.stockAlmacen.update({
          where: {
            productoId_almacenId: {
              productoId: detalle.productoId,
              almacenId: createDto.almacenId,
            },
          },
          data: { stock: nuevoSaldo },
        });

        // d) Actualizar el stock global (suma de todos los almacenes)
        const stockTotalGlobal = await prismaTx.stockAlmacen.aggregate({
          _sum: { stock: true },
          where: { productoId: detalle.productoId },
        });

        await prismaTx.producto.update({
          where: { id: detalle.productoId },
          data: { stock: stockTotalGlobal._sum.stock || 0 },
        });
      }

      return devolucion;
    });
  }

  async findAll(empresaId: string) {
    return this.prisma.devolucionProveedor.findMany({
      where: { empresaId },
      orderBy: { fecha: 'desc' },
      include: {
        proveedor: { select: { id: true, razonSocial: true, ruc: true } },
        almacen: { select: { id: true, nombre: true } },
      },
    });
  }

  async findOne(empresaId: string, id: string) {
    const devolucion = await this.prisma.devolucionProveedor.findFirst({
      where: { id, empresaId },
      include: {
        proveedor: { select: { id: true, razonSocial: true, ruc: true } },
        almacen: { select: { id: true, nombre: true } },
        detalles: {
          include: {
            producto: { select: { id: true, nombre: true, codigoInterno: true } },
          },
        },
      },
    });

    if (!devolucion) {
      throw new BadRequestException('Devolución no encontrada');
    }

    return devolucion;
  }
}
