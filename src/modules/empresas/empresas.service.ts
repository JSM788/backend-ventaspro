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
    return this.prisma.empresa.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        _count: {
          select: { comprobantes: true, usuariosErp: true }
        }
      }
    });
  }

  async getConfig(empresaId?: string) {
    if (empresaId) {
      return this.prisma.empresa.findUnique({ where: { id: empresaId } });
    }
    return this.prisma.empresa.findFirst();
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

      // Enviamos de forma asíncrona pero sin bloquear la respuesta si no es estrictamente necesario,
      // aunque aquí hacemos el await para asegurarnos de que atrape errores.
      try {
        await this.mailService.sendWelcomeEmail(
          data.adminEmail,
          `¡Bienvenido a VentasPro, ${empresa.razonSocial}!`,
          emailHtml
        );
      } catch (mailError) {
        console.error("Error al enviar el correo:", mailError);
      }

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

      // Si tipoNegocioId cambia y es válido, podríamos actualizar los módulos, pero para mantenerlo
      // simple por ahora solo actualizamos el campo tipoNegocioId en la empresa.

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

  async createConfig(data: any, empresaId?: string) {
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

  async updateConfig(data: any, empresaId?: string) {
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
  async uploadLogo(tipo: 'claro' | 'oscuro', file: Express.Multer.File, empresaId?: string) {
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
}
