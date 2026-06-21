import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { StorageService } from '../../core/storage/storage.interface';
import { MailService } from '../../core/mail/mail.service';

@Injectable()
export class EmpresasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mailService: MailService,
  ) {}

  async getAllEmpresas() {
    const list = await this.prisma.empresa.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        usuariosErp: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { email: true }
        },
        _count: {
          select: { comprobantes: true, usuariosErp: true }
        }
      }
    });

    return list.map(emp => ({
      id: emp.id,
      name: emp.razonSocial,
      ruc: emp.ruc,
      plan: emp.plan?.nombre || 'PRO',
      planId: emp.planId || undefined,
      tipoNegocioId: emp.tipoNegocioId,
      status: emp.estado,
      comprobantesMes: emp._count.comprobantes,
      adminEmail: emp.usuariosErp[0]?.email || ''
    }));
  }

  async getConfig(empresaId: string) {
    if (!empresaId) throw new BadRequestException('Empresa no definida');
    return this.prisma.empresa.findUnique({ where: { id: empresaId } });
  }

  async getPlanes() {
    return this.prisma.plan.findMany({
      where: { activo: true, esPersonalizado: false },
      orderBy: { precioMensual: 'asc' }
    });
  }

  async getTiposNegocio() {
    return this.prisma.tipoNegocio.findMany({
      orderBy: { nombre: 'asc' }
    });
  }

  async createEmpresaCompleta(data: any) {
    try {
      if (!data.planId) throw new BadRequestException('El plan es obligatorio.');
      if (!data.adminEmail) throw new BadRequestException('El correo del administrador es obligatorio.');

      const plan = await this.prisma.plan.findUnique({ where: { id: data.planId } });
      if (!plan) throw new BadRequestException('Plan inválido o no encontrado.');

      // Validar si el correo ya existe en usuarios (para no chocar luego)
      const existingUser = await this.prisma.usuarioErp.findFirst({ where: { email: data.adminEmail } });
      if (existingUser) {
        throw new BadRequestException('El correo ingresado ya está registrado por otro usuario.');
      }

      // Generar un slug básico a partir de la razón social + sufijo random
      const baseSlug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      
      const uniqueSuffix = Math.random().toString(36).substring(2, 6);
      const slug = `${baseSlug || 'empresa'}-${uniqueSuffix}`;

      // Calcular ciclo
      const cicloInicio = new Date();
      const cicloFin = new Date(cicloInicio);
      cicloFin.setMonth(cicloFin.getMonth() + 1);

      // Generar contraseña aleatoria
      const passwordAleatoria = Math.random().toString(36).slice(-8) + 'Vp!';

      // Crear la empresa

      const empresa = await this.prisma.empresa.create({
        data: {
          ruc: data.ruc,
          razonSocial: data.name,
          slug: slug,
          planId: plan.id,
          tipoNegocioId: data.tipoNegocioId || null,
          limite: {
            create: {
              planId: plan.id,
              facturasBase: plan.limiteFacturas,
              usuariosBase: plan.limiteUsuarios,
              sucursalesBase: plan.limiteSucursales,
              productosBase: plan.limiteProductos,
              cicloInicio,
              cicloFin
            }
          }
        },
      });

      // Si se envió tipoNegocioId, inyectar los módulos de ese negocio
      if (data.tipoNegocioId) {
        const modulosNegocio = await this.prisma.tipoNegocioModulo.findMany({
          where: { tipoNegocioId: data.tipoNegocioId }
        });

        // Si el seed no asoció módulos al negocio, al menos asignamos todos los existentes para evitar dejar la empresa sin acceso
        let modulosAInsertar = modulosNegocio.map(m => m.moduloId);
        
        if (modulosAInsertar.length === 0) {
          const todosLosModulos = await this.prisma.modulo.findMany();
          modulosAInsertar = todosLosModulos.map(m => m.id);
        }

        if (modulosAInsertar.length > 0) {
          await this.prisma.empresaModulo.createMany({
            data: modulosAInsertar.map(modId => ({
              empresaId: empresa.id,
              moduloId: modId,
              activo: true
            }))
          });
        }
      }

      // 3. Crear el Usuario Administrador
      const authUserId = `auth-${Date.now()}`; // Simulación de ID del proveedor de auth (ej. Firebase/Supabase)
      await this.prisma.usuarioErp.create({
        data: {
          empresaId: empresa.id,
          authUserId,
          email: data.adminEmail,
          password: passwordAleatoria, // En producción debería ir hasheado
          isSuperAdmin: false,
        }
      });

      // 4. Asignarle el rol EMPRESA_ADMIN (si existe o crearlo)
      let rolAdmin = await this.prisma.rol.findFirst({
        where: { empresaId: empresa.id, nombre: 'ADMINISTRADOR' }
      });

      if (!rolAdmin) {
        rolAdmin = await this.prisma.rol.create({
          data: {
            empresaId: empresa.id,
            nombre: 'ADMINISTRADOR',
          }
        });
      }

      // En el esquema actual, la relación de Rol - Usuario puede que no exista explícitamente en el mock, 
      // pero por ahora el email y password ya sirven para el login simulado.

      // 5. Enviar el correo usando MailService (Ethereal o SMTP real)
      const { buildWelcomeEmailTemplate } = require('../../core/mail/templates/welcome.template');
      const emailHtml = buildWelcomeEmailTemplate(empresa.razonSocial, data.adminEmail, passwordAleatoria);

      // Enviamos de forma asíncrona (background) para no bloquear la respuesta HTTP
      try {
        this.mailService.sendWelcomeEmail(
          data.adminEmail,
          `¡Bienvenido a VentasPro, ${empresa.razonSocial}!`,
          emailHtml
        ).catch(mailError => console.error("Error al enviar el correo en background:", mailError));
      } catch (mailError) {
        console.error("Error síncrono al preparar el correo:", mailError);
      }

      // Imprimir datos de acceso en consola para debug y logs de Render
      console.log('===================================================');
      console.log(`🔑 NUEVA EMPRESA CREADA EN EL SISTEMA:`);
      console.log(`🏢 Empresa: ${empresa.razonSocial} (RUC: ${empresa.ruc})`);
      console.log(`📧 Correo Administrador: ${data.adminEmail}`);
      console.log(`🔒 Contraseña Temporal Generada: ${passwordAleatoria}`);
      console.log('===================================================');

      // Devolvemos la password en el response temporalmente para testing rápido (útil en entornos de dev)
      return { ...empresa, temporaryPassword: passwordAleatoria };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('El RUC o Nombre de esta empresa ya se encuentra registrado.');
      }
      throw error;
    }
  }

  async updateEmpresa(id: string, data: any) {
    try {
      const empresa = await this.prisma.empresa.findUnique({
        where: { id },
        include: { limite: true }
      });

      if (!empresa) throw new BadRequestException('Empresa no encontrada.');

      // Si el plan cambió, validar y actualizar límites
      let newLimites: any = undefined;
      if (data.planId && data.planId !== empresa.planId) {
        const plan = await this.prisma.plan.findUnique({ where: { id: data.planId } });
        if (!plan) throw new BadRequestException('Plan inválido o no encontrado.');

        newLimites = {
          update: {
            planId: plan.id,
            facturasBase: plan.limiteFacturas,
            usuariosBase: plan.limiteUsuarios,
            sucursalesBase: plan.limiteSucursales,
            productosBase: plan.limiteProductos,
          }
        };
      }

      // Si se pasa un nuevo email de administrador, actualizar el usuario correspondiente
      if (data.adminEmail) {
        const existingUser = await this.prisma.usuarioErp.findFirst({
          where: {
            email: data.adminEmail,
            NOT: { empresaId: id }
          }
        });
        if (existingUser) {
          throw new BadRequestException('El correo ingresado ya está registrado por otra empresa.');
        }

        const adminUser = await this.prisma.usuarioErp.findFirst({
          where: { empresaId: id },
          orderBy: { createdAt: 'asc' }
        });

        if (adminUser) {
          await this.prisma.usuarioErp.update({
            where: { id: adminUser.id },
            data: { email: data.adminEmail }
          });
        }
      }

      const updatedEmpresa = await this.prisma.empresa.update({
        where: { id },
        data: {
          ruc: data.ruc !== undefined ? data.ruc : undefined,
          razonSocial: data.name !== undefined ? data.name : undefined,
          tipoNegocioId: data.tipoNegocioId !== undefined ? data.tipoNegocioId : undefined,
          planId: data.planId !== undefined ? data.planId : undefined,
          estado: data.status !== undefined ? data.status : undefined,
          ...(newLimites ? { limite: newLimites } : {})
        }
      });

      return updatedEmpresa;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('El RUC o Nombre ingresado ya está siendo usado por otra empresa.');
      }
      throw error;
    }
  }

  async createConfig(data: any, empresaId: string) {
    const existing = await this.getConfig(empresaId);
    if (existing) {
      throw new Error('La empresa ya está configurada. Usa PUT para actualizar.');
    }

    // Generar un slug básico a partir de la razón social
    const slug = data.razonSocial
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    return this.prisma.empresa.create({
      data: {
        ruc: data.ruc,
        razonSocial: data.razonSocial,
        slug: slug || 'empresa',
      },
    });
  }

  async updateConfig(data: any, empresaId: string) {
    const empresa = await this.getConfig(empresaId);
    if (!empresa) {
      throw new Error('No hay empresa configurada. Usa POST para crearla primero.');
    }
    return this.prisma.empresa.update({
      where: { id: empresa.id },
      data: {
        ruc: data.ruc,
        razonSocial: data.razonSocial,
      },
    });
  }

  /**
   * Sube un logo de empresa al StorageService.
   * @param tipo 'claro' | 'oscuro'
   * @param file Archivo recibido por Multer (FileInterceptor)
   */
  async uploadLogo(tipo: 'claro' | 'oscuro', file: Express.Multer.File, empresaId: string) {
    const empresa = await this.getConfig(empresaId);
    if (!empresa) {
      throw new Error('No hay empresa configurada para subir un logo.');
    }

    // Eliminar logo anterior si existe (para no acumular archivos huérfanos)
    const pathActual = tipo === 'claro' ? empresa.logoClaro : empresa.logoOscuro;
    if (pathActual) {
      await this.storage.delete(pathActual);
    }

    // Subir el nuevo logo al proveedor activo
    const tenantKey = `${empresa.slug}-${empresa.id.substring(0, 8)}`;
    const result = await this.storage.upload(
      'public',
      tenantKey,
      'config', // Módulo
      file.originalname,
      file.buffer,
      file.mimetype,
      false
    );

    // Guardar la URL resultante en la BD
    await this.prisma.empresa.update({
      where: { id: empresa.id },
      data: {
        ...(tipo === 'claro' ? { logoClaro: result.path } : { logoOscuro: result.path }),
      },
    });

    return { url: result.url };
  }

  async remove(id: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Borrar transaccionales y detalles (Compras, Ventas, Traslados, Devoluciones, Pagos)
        await tx.comprobanteRelacion.deleteMany({
          where: {
            OR: [
              { origen: { empresaId: id } },
              { destino: { empresaId: id } }
            ]
          }
        });
        await tx.comprobanteCuota.deleteMany({ where: { comprobante: { empresaId: id } } });
        await tx.pagoAplicacion.deleteMany({ where: { pago: { empresaId: id } } });
        
        await tx.comprobanteDetalle.deleteMany({ where: { comprobante: { empresaId: id } } });
        await tx.pago.deleteMany({ where: { empresaId: id } });
        await tx.comprobante.deleteMany({ where: { empresaId: id } });
        await tx.cotizacion.deleteMany({ where: { empresaId: id } });
        await tx.pedido.deleteMany({ where: { empresaId: id } });
        
        await tx.ordenCompraDetalle.deleteMany({ where: { ordenCompra: { empresaId: id } } });
        await tx.ordenCompra.deleteMany({ where: { empresaId: id } });
        
        await tx.devolucionProveedorDetalle.deleteMany({ where: { devolucion: { empresaId: id } } });
        await tx.devolucionProveedor.deleteMany({ where: { empresaId: id } });

        await tx.trasladoDetalle.deleteMany({ where: { traslado: { empresaId: id } } });
        await tx.traslado.deleteMany({ where: { empresaId: id } });

        await tx.pedidoTiendaDetalle.deleteMany({ where: { pedidoTienda: { empresaId: id } } });
        await tx.pedidoTienda.deleteMany({ where: { empresaId: id } });
        await tx.clienteTienda.deleteMany({ where: { empresaId: id } });

        // 2. Borrar Inventario y Almacenes (Kardex, StockAlmacen, Almacenes)
        await tx.movimientoKardex.deleteMany({ where: { almacen: { empresaId: id } } });
        await tx.stockAlmacen.deleteMany({ where: { empresaId: id } });
        await tx.almacen.deleteMany({ where: { empresaId: id } });

        // 3. Borrar Cajas y Turnos
        await tx.cajaMovimiento.deleteMany({ where: { turno: { empresaId: id } } });
        await tx.cajaTurno.deleteMany({ where: { empresaId: id } });
        await tx.cajaCuenta.deleteMany({ where: { empresaId: id } });

        // 4. Borrar Catálogo (Productos, Categorías, Marcas, Unidades alternativas)
        await tx.productoUnidadAlternativa.deleteMany({ where: { producto: { empresaId: id } } });
        await tx.producto.deleteMany({ where: { empresaId: id } });
        await tx.categoria.deleteMany({ where: { empresaId: id } });
        await tx.marca.deleteMany({ where: { empresaId: id } });
        await tx.unidadMedida.deleteMany({ where: { empresaId: id } });

        // 5. Borrar Series y Clientes
        await tx.serieConfig.deleteMany({ where: { empresaId: id } });
        await tx.clienteSaldo.deleteMany({ where: { cliente: { empresaId: id } } });
        await tx.cliente.deleteMany({ where: { empresaId: id } });
        await tx.tipoCliente.deleteMany({ where: { empresaId: id } });

        // 6. Borrar Seguridad e Infra (Usuarios, Roles, Modulos asignados, Límites)
        await tx.usuarioRol.deleteMany({ where: { usuario: { empresaId: id } } });
        await tx.rolPermiso.deleteMany({ where: { rol: { empresaId: id } } });
        await tx.rol.deleteMany({ where: { empresaId: id } });
        await tx.usuarioErp.deleteMany({ where: { empresaId: id } });

        await tx.empresaModulo.deleteMany({ where: { empresaId: id } });
        await tx.empresaLimite.deleteMany({ where: { empresaId: id } });
        await tx.empresaAddOn.deleteMany({ where: { empresaId: id } });
        await tx.tiendaConfiguracion.deleteMany({ where: { empresaId: id } });
        
        // 7. Borrar finalmente la Empresa
        await tx.empresa.delete({ where: { id } });
      });
      return { success: true };
    } catch (e: any) {
      throw new BadRequestException('Error al eliminar la empresa: ' + e.message);
    }
  }
}
