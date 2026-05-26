import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.cliente.findMany({
      include: { tipoCliente: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: number) {
    return this.prisma.cliente.findUnique({
      where: { id },
      include: { tipoCliente: true },
    });
  }

  async create(data: any) {
    return this.prisma.cliente.create({
      data,
    });
  }

  async update(id: number, data: any) {
    return this.prisma.cliente.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    return this.prisma.cliente.delete({
      where: { id },
    });
  }

  async validateRuc(numero: string) {
    // 1. Buscar en BD local
    const clienteLocal = await this.prisma.cliente.findUnique({ where: { ruc: numero } });
    if (clienteLocal) {
      return { 
        source: 'local', 
        razonSocial: clienteLocal.razonSocial, 
        ruc: clienteLocal.ruc, 
        direccion: clienteLocal.direccion 
      };
    }

    // 2. Si no existe, buscar en apis.net.pe
    const token = process.env.APIS_NET_PE_TOKEN;
    if (!token) throw new BadRequestException('Token de apis.net.pe no configurado');

    try {
      const isRuc = numero.length === 11;
      const endpoint = isRuc 
        ? `https://api.apis.net.pe/v1/ruc?numero=${numero}`
        : `https://api.apis.net.pe/v1/dni?numero=${numero}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('No encontrado');
      }

      const data = await response.json();
      
      const rucDni = data.numeroDocumento;
      const razonSocial = data.nombre;
      const direccion = isRuc ? data.direccion : '';

      // Guardarlo en nuestra base de datos local automáticamente
      try {
        let tipoCliente = await this.prisma.tipoCliente.findFirst();
        if (!tipoCliente) {
          tipoCliente = await this.prisma.tipoCliente.create({
            data: { nombre: 'General', descripcion: 'Tipo de cliente por defecto' }
          });
        }

        await this.prisma.cliente.create({
          data: {
            ruc: rucDni,
            razonSocial: razonSocial,
            direccion: direccion,
            tipoClienteId: tipoCliente.id
          }
        });
      } catch (e) {
        // Silenciamos posibles errores de concurrencia al guardar
        console.log("El cliente ya fue guardado o hubo un error menor al persistir:", e);
      }

      return {
        source: 'api',
        ruc: rucDni,
        razonSocial: razonSocial,
        direccion: direccion
      };
    } catch (error) {
      throw new BadRequestException('No se pudo validar el documento en SUNAT/RENIEC');
    }
  }
}
