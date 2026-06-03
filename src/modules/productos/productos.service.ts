import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    let empresa = await this.prisma.empresa.findFirst();
    if (!empresa) throw new BadRequestException('No existe empresa base');
    
    return this.prisma.producto.findMany({
      where: { empresaId: empresa.id },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(data: any) {
    let empresa = await this.prisma.empresa.findFirst();
    if (!empresa) throw new BadRequestException('No existe empresa base');

    let categoriaId: number | null = null;
    if (data.categoria) {
      let cat = await this.prisma.categoria.findFirst({ where: { nombre: data.categoria, empresaId: empresa.id } });
      if (!cat) {
        cat = await this.prisma.categoria.create({ data: { nombre: data.categoria, empresaId: empresa.id } });
      }
      categoriaId = cat.id;
    }

    let marcaId: number | null = null;
    if (data.marca) {
      let mar = await this.prisma.marca.findFirst({ where: { nombre: data.marca, empresaId: empresa.id } });
      if (!mar) {
        mar = await this.prisma.marca.create({ data: { nombre: data.marca, empresaId: empresa.id } });
      }
      marcaId = mar.id;
    }

    return this.prisma.producto.create({
      data: {
        empresaId: empresa.id,
        tipo: data.tipo || 'PRODUCTO',
        nombre: data.nombre,
        descripcion: data.descripcion,
        unidadMedida: data.unidad || 'NIU',
        precioUnitario: data.precioUnitario ? Number(data.precioUnitario) : 0,
        incluyeIgv: data.incluyeIgv ?? true,
        tipoAfectacion: data.tipoAfectacion || '10',
        stock: data.stockInicial ? Number(data.stockInicial) : 0,
        codigoInterno: data.codigoInterno,
        codigoSunat: data.codigoSunat,
        imagenUrl: data.imagenUrl,
        marcaId,
        categoriaId,
      },
      include: {
        empresa: true,
        categoria: true,
        marca: true
      }
    });
  }

  async updateImageUrl(id: number, url: string) {
    return this.prisma.producto.update({
      where: { id },
      data: { imagenUrl: url }
    });
  }

  async findOne(id: number) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      include: { categoria: true, marca: true }
    });
    if (!producto) throw new BadRequestException('Producto no encontrado');
    return producto;
  }

  async update(id: number, data: any) {
    const productoInfo = await this.prisma.producto.findUnique({ where: { id } });
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
        unidadMedida: data.unidad,
        precioUnitario: data.precioUnitario !== undefined ? Number(data.precioUnitario) : undefined,
        incluyeIgv: data.incluyeIgv,
        tipoAfectacion: data.tipoAfectacion,
        stock: data.stock !== undefined ? Number(data.stock) : undefined,
        codigoInterno: data.codigoInterno,
        codigoSunat: data.codigoSunat,
        imagenUrl: data.imagenUrl,
        marcaId,
        categoriaId,
      },
      include: {
        categoria: true,
        marca: true
      }
    });
  }

  async remove(id: number) {
    return this.prisma.producto.delete({
      where: { id }
    });
  }
}
