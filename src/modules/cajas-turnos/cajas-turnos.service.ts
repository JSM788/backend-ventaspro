import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class CajasTurnosService {
  constructor(private readonly prisma: PrismaService) {}

  async aperturarTurno(empresaId: string, usuarioId: string, data: { montoInicial: number; cajaCuentaId: number; observaciones?: string }) {
    // 1. Verificar si el usuario ya tiene un turno abierto en la misma empresa
    const turnoAbierto = await this.prisma.cajaTurno.findFirst({
      where: {
        empresaId,
        usuarioId,
        estado: 'ABIERTO',
      },
    });

    if (turnoAbierto) {
      throw new BadRequestException('El usuario ya tiene un turno de caja abierto.');
    }

    // Buscar o crear caja principal por defecto si la base está limpia (MVP mode)
    let cajaCuenta = await this.prisma.cajaCuenta.findFirst({
      where: { empresaId }
    });

    if (!cajaCuenta) {
      cajaCuenta = await this.prisma.cajaCuenta.create({
        data: {
          empresaId,
          nombre: "Caja Principal",
          tipo: "EFECTIVO",
          moneda: "PEN",
          saldo: 0
        }
      });
    }

    // 2. Crear el nuevo turno
    return this.prisma.cajaTurno.create({
      data: {
        empresaId,
        usuarioId,
        cajaCuentaId: cajaCuenta.id,
        montoInicial: data.montoInicial,
        estado: 'ABIERTO',
        observaciones: data.observaciones,
      },
    });
  }

  async cerrarTurno(empresaId: string, usuarioId: string, turnoId: string, data: { montoArqueado: number; observaciones?: string }) {
    // 1. Validar el turno
    const turno = await this.prisma.cajaTurno.findFirst({
      where: {
        id: turnoId,
        empresaId,
        usuarioId,
        estado: 'ABIERTO',
      },
      include: {
        movimientos: true,
      },
    });

    if (!turno) {
      throw new NotFoundException('Turno de caja no encontrado o ya está cerrado.');
    }

    // 2. Calcular el efectivo esperado
    let totalIngresos = 0;
    let totalEgresos = 0;

    for (const mov of turno.movimientos) {
      if (mov.tipo === 'INGRESO') totalIngresos += Number(mov.monto);
      if (mov.tipo === 'EGRESO') totalEgresos += Number(mov.monto);
    }

    const montoEfectivoEsperado = Number(turno.montoInicial) + totalIngresos - totalEgresos;
    const diferencia = data.montoArqueado - montoEfectivoEsperado;

    // 3. Cerrar el turno
    return this.prisma.cajaTurno.update({
      where: { id: turnoId },
      data: {
        estado: 'CERRADO',
        fechaCierre: new Date(),
        montoEfectivo: montoEfectivoEsperado,
        montoArqueado: data.montoArqueado,
        diferencia,
        observaciones: data.observaciones ? `${turno.observaciones || ''} | Cierre: ${data.observaciones}` : turno.observaciones,
      },
    });
  }

  async obtenerTurnoActivo(empresaId: string, usuarioId: string) {
    const turno = await this.prisma.cajaTurno.findFirst({
      where: {
        empresaId,
        usuarioId,
        estado: 'ABIERTO',
      },
      include: {
        cajaCuenta: true,
      },
    });

    if (!turno) {
      return null;
    }

    // Calcular montos al vuelo
    const movimientos = await this.prisma.cajaMovimiento.findMany({
      where: { turnoId: turno.id },
    });

    let ingresos = 0;
    let egresos = 0;
    for (const mov of movimientos) {
      if (mov.tipo === 'INGRESO') ingresos += Number(mov.monto);
      if (mov.tipo === 'EGRESO') egresos += Number(mov.monto);
    }

    const efectivoEsperado = Number(turno.montoInicial) + ingresos - egresos;

    return {
      ...turno,
      ventasAcumuladas: ingresos,
      egresosAcumulados: egresos,
      efectivoEsperado,
    };
  }

  async registrarMovimiento(turnoId: string, data: { tipo: 'INGRESO' | 'EGRESO', monto: number, descripcion: string }) {
    const turno = await this.prisma.cajaTurno.findUnique({ where: { id: turnoId } });
    if (!turno || turno.estado !== 'ABIERTO') {
      throw new BadRequestException('El turno de caja no existe o ya está cerrado');
    }

    return this.prisma.cajaMovimiento.create({
      data: {
        turnoId,
        tipo: data.tipo,
        monto: data.monto,
        descripcion: data.descripcion,
      }
    });
  }
}
