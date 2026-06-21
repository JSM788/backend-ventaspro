import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class TiendaVirtualService {
  constructor(
    private prisma: PrismaService
  ) {}

  async getEmpresaBySlug(slug: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { slug },
      select: {
        id: true,
        razonSocial: true,
        slug: true,
        logoClaro: true,
        logoOscuro: true,
        porcentajeIgv: true,
        tiendaConfiguracion: true,
        // nombreComercial, telefono1, direccion, configuracion no existen actualmente en Prisma
      }
    });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return empresa;
  }

  async getProductosBySlug(slug: string) {
    const empresa = await this.getEmpresaBySlug(slug);

    // Solo devolver productos activos, que no sean combos/servicios si así lo desean, 
    // pero principalment donde publicarEnTienda sea true
    const productos = await this.prisma.producto.findMany({
      where: {
        empresaId: empresa.id,
        publicarEnTienda: true,
      },
      include: {
        categoria: { select: { id: true, nombre: true } },
        marca: { select: { id: true, nombre: true } }
      },
      orderBy: [
        { destacado: 'desc' },
        { nombre: 'asc' }
      ]
    });

    return productos;
  }

  async procesarCheckout(slug: string, data: any) {
    const empresa = await this.getEmpresaBySlug(slug);
    
    // 1. Encontrar o crear cliente genérico
    const rucDoc = data.cliente?.numeroDocumento || data.clienteDocumento || '00000000';
    const nombreCliente = data.cliente?.nombres 
      ? `${data.cliente.nombres} ${data.cliente.apellidos}` 
      : (data.clienteNombre || 'Público en General');
      
    let cliente = await this.prisma.cliente.findFirst({
      where: {
        empresaId: empresa.id,
        ruc: rucDoc
      }
    });

    if (!cliente) {
      cliente = await this.prisma.cliente.create({
        data: {
          empresaId: empresa.id,
          ruc: rucDoc,
          razonSocial: nombreCliente,
          direccion: data.direccion || data.cliente?.direccion || '',
          telefono: data.telefono || data.cliente?.telefono || '',
          email: data.cliente?.email || '',
        }
      });
    }

    // 2. Construir items de la nota de venta y comprobante
    const esBoleta = data.comprobante === 'boleta';
    const tipoComp = esBoleta ? 'BOLETA' : 'NOTA_VENTA';
    const serieComp = esBoleta ? 'B001' : 'N001';
    
    // Obtener correlativo
    const count = await this.prisma.comprobante.count({
      where: { empresaId: empresa.id, tipo: tipoComp }
    });

    // 3. Validar integridad de precios (Price Integrity Check)
    const items = data.items || data.detalles || [];
    if (!items.length) {
      throw new ConflictException('El carrito está vacío');
    }

    const productoIds = items.map((i: any) => i.productoId);
    const productosBd = await this.prisma.producto.findMany({
      where: { id: { in: productoIds }, empresaId: empresa.id }
    });

    const productosMap = new Map(productosBd.map(p => [p.id, p]));
    const porcentajeIgv = Number(empresa.porcentajeIgv ?? 18);
    
    let totalReal = 0;
    let operacionGravadaReal = 0;
    let igvReal = 0;

    const detallesValidados = items.map((item: any) => {
      const prodBd = productosMap.get(item.productoId);
      if (!prodBd) {
        throw new NotFoundException(`Producto con ID ${item.productoId} no encontrado.`);
      }

      const precioUnitarioReal = Number(prodBd.precioUnitario);
      const subtotalReal = precioUnitarioReal * item.cantidad;
      totalReal += subtotalReal;

      let valVentaItem = 0;
      let igvItem = 0;

      if (prodBd.tipoAfectacion === '10') {
        const base = subtotalReal / (1 + porcentajeIgv / 100);
        valVentaItem = base;
        igvItem = subtotalReal - base;
        
        operacionGravadaReal += base;
        igvReal += igvItem;
      } else {
        valVentaItem = subtotalReal;
      }

      // Validar si el frontend mandó el precio para mostrar alerta de qué producto cambió (Opcional)
      // if (Math.abs(Number(item.precioUnitario) - precioUnitarioReal) > 0.1) { console.log("Cambió"); }

      return {
        productoId: prodBd.id,
        descripcion: prodBd.nombre,
        cantidad: item.cantidad,
        precioUnitario: precioUnitarioReal,
        valorUnitario: Number(valVentaItem.toFixed(2)),
        igv: Number(igvItem.toFixed(2)),
        subtotal: Number(valVentaItem.toFixed(2)),
        total: Number(subtotalReal.toFixed(2))
      };
    });

    // 4. Verificación de discrepancia
    const totalFrontend = Number(data.total || 0);
    const diferencia = Math.abs(totalFrontend - totalReal);

    if (diferencia > 0.1) {
      throw new ConflictException(
        'Los precios de uno o más productos han sido actualizados recientemente. Por favor, revisa tu carrito e intenta nuevamente.'
      );
    }

    // 5. Generar pedido con valores autorizados
    const nuevoPedido = await this.prisma.comprobante.create({
      data: {
        empresaId: empresa.id,
        tipo: tipoComp,
        serie: serieComp,
        correlativo: count + 1,
        transaccionId: `B2C-${empresa.id.substring(0,6)}-${Date.now()}`,
        fechaEmision: new Date(),
        clienteId: cliente.id,
        moneda: 'PEN',
        operacionGravada: Number(operacionGravadaReal.toFixed(2)),
        igv: Number(igvReal.toFixed(2)),
        total: Number(totalReal.toFixed(2)),
        condicionPago: 'CONTADO',
        estadoPago: data.metodoPago === 'efectivo' ? 'PENDIENTE' : 'PAGADO',
        observaciones: `Pedido B2C. Tel: ${cliente.telefono} | Dir: ${cliente.direccion}`,
        estadoSunat: 'PENDIENTE',
        viaEmision: 'NATIVO',
        detalles: {
          create: detallesValidados
        }
      }
    });

    return {
      message: 'Pedido recibido exitosamente',
      data: nuevoPedido
    };
  }
}
