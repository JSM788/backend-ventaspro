import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(empresaId: string) {
    return this.prisma.producto.findMany({
      where: { empresaId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(empresaId: string, data: any) {
    let categoriaId: number | null = null;
    if (data.categoria) {
      let cat = await this.prisma.categoria.findFirst({ where: { nombre: data.categoria, empresaId } });
      if (!cat) {
        cat = await this.prisma.categoria.create({ data: { nombre: data.categoria, empresaId } });
      }
      categoriaId = cat.id;
    }

    let marcaId: number | null = null;
    if (data.marca) {
      let mar = await this.prisma.marca.findFirst({ where: { nombre: data.marca, empresaId } });
      if (!mar) {
        mar = await this.prisma.marca.create({ data: { nombre: data.marca, empresaId } });
      }
      marcaId = mar.id;
    }

    const producto = await this.prisma.producto.create({
      data: {
        empresaId,
        tipo: data.tipo || 'PRODUCTO',
        nombre: data.nombre,
        descripcion: data.descripcion,
        unidadBaseId: data.unidadBaseId,
        precioUnitario: data.precioUnitario,
        incluyeIgv: data.incluyeIgv ?? true,
        tipoAfectacion: data.tipoAfectacion || '10',
        stock: data.stockInicial || 0,
        codigoInterno: data.codigoInterno,
        codigoSunat: data.codigoSunat,
        imagenUrl: data.imagenUrl,
        marcaId,
        categoriaId,
        precioOriginal: data.precioOriginal,
        publicarEnTienda: data.publicarEnTienda ?? false,
        mostrarStockEnTienda: data.mostrarStockEnTienda ?? false,
        destacado: data.destacado ?? false,
        controlarStock: data.controlarStock ?? true,
      },
      include: {
        empresa: true,
        categoria: true,
        marca: true
      }
    });

    // Registrar stock inicial si existe
    if (data.stockInicial && data.stockInicial > 0) {
      let almacen = await this.prisma.almacen.findFirst({
        where: { empresaId, esPrincipal: true }
      });
      if (!almacen) {
        almacen = await this.prisma.almacen.findFirst({
          where: { empresaId }
        });
      }

      if (almacen) {
        await this.prisma.movimientoKardex.create({
          data: {
            almacenId: almacen.id,
            productoId: producto.id,
            tipoOperacion: 'INGRESO_INICIAL',
            cantidad: data.stockInicial,
            costoUnitario: data.precioUnitario || 0,
            saldoActual: data.stockInicial,
            observacion: 'Inventario inicial al crear producto'
          }
        });

        await this.prisma.stockAlmacen.create({
          data: {
            empresaId,
            productoId: producto.id,
            almacenId: almacen.id,
            stock: data.stockInicial
          }
        });
      }
    }

    return producto;
  }

  async updateImageUrl(id: number, empresaId: string, url: string) {
    return this.prisma.producto.update({
      where: { id, empresaId },
      data: { imagenUrl: url }
    });
  }

  async findOne(id: number, empresaId: string) {
    const producto = await this.prisma.producto.findFirst({
      where: { id, empresaId },
      include: { categoria: true, marca: true }
    });
    if (!producto) throw new BadRequestException('Producto no encontrado');
    return producto;
  }

  async update(id: number, empresaId: string, data: any) {
    const productoInfo = await this.prisma.producto.findFirst({ where: { id, empresaId } });
    if (!productoInfo) throw new BadRequestException('Producto no encontrado');

    let categoriaId: number | null = productoInfo.categoriaId;
    if (data.categoria) {
      let cat = await this.prisma.categoria.findFirst({ where: { nombre: data.categoria, empresaId: productoInfo.empresaId } });
      if (!cat) {
        cat = await this.prisma.categoria.create({ data: { nombre: data.categoria, empresaId: productoInfo.empresaId } });
      }
      categoriaId = cat.id;
    }

    let marcaId: number | null = productoInfo.marcaId;
    if (data.marca) {
      let mar = await this.prisma.marca.findFirst({ where: { nombre: data.marca, empresaId: productoInfo.empresaId } });
      if (!mar) {
        mar = await this.prisma.marca.create({ data: { nombre: data.marca, empresaId: productoInfo.empresaId } });
      }
      marcaId = mar.id;
    }

    return this.prisma.producto.update({
      where: { id },
      data: {
        tipo: data.tipo,
        nombre: data.nombre,
        descripcion: data.descripcion,
        unidadBaseId: data.unidadBaseId,
        precioUnitario: data.precioUnitario,
        incluyeIgv: data.incluyeIgv,
        tipoAfectacion: data.tipoAfectacion,
        stock: data.stock,
        codigoInterno: data.codigoInterno,
        codigoSunat: data.codigoSunat,
        imagenUrl: data.imagenUrl,
        marcaId,
        categoriaId,
        precioOriginal: data.precioOriginal,
        publicarEnTienda: data.publicarEnTienda,
        mostrarStockEnTienda: data.mostrarStockEnTienda,
        destacado: data.destacado,
        controlarStock: data.controlarStock,
      },
      include: {
        categoria: true,
        marca: true
      }
    });
  }

  async remove(id: number, empresaId: string) {
    return this.prisma.producto.deleteMany({
      where: { id, empresaId }
    });
  }
}
