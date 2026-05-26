import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class FinanzasService {
  constructor(private readonly db: PrismaService) {}
  
  // ==========================================
  // CAJAS Y CUENTAS
  // ==========================================
  async getCuentas(empresaId: string) {
    let cuentas = await this.db.cajaCuenta.findMany({
      where: { empresaId, estado: 'ACTIVO' },
      orderBy: { id: 'asc' }
    });

    if (cuentas.length === 0) {
      await this.db.cajaCuenta.create({
        data: { empresaId, nombre: 'Caja General (Efectivo)', tipo: 'EFECTIVO' }
      });
      await this.db.cajaCuenta.create({
        data: { empresaId, nombre: 'Cuenta BCP', tipo: 'BANCO' }
      });
      cuentas = await this.db.cajaCuenta.findMany({
        where: { empresaId, estado: 'ACTIVO' },
        orderBy: { id: 'asc' }
      });
    }
    return cuentas;
  }

  // ==========================================
  // PAGOS
  // ==========================================
  async getPagosPorComprobante(comprobanteId: string) {
    return await this.db.pago.findMany({
      where: { comprobanteId },
      include: { cuenta: true },
      orderBy: { fechaPago: 'desc' }
    });
  }

  async registrarPago(comprobanteId: string, data: any) {
    return await this.db.$transaction(async (tx) => {
      const comprobante = await tx.comprobante.findUnique({
        where: { id: comprobanteId },
        include: { cuotas: { orderBy: { fechaVencimiento: 'asc' } } }
      });

      if (!comprobante) {
        throw new NotFoundException('Comprobante no encontrado');
      }

      // Si no tiene cuotas (comprobantes antiguos o contado), le creamos una cuota virtual por el total
      let cuotas = comprobante.cuotas;
      if (cuotas.length === 0) {
        const nuevaCuota = await tx.comprobanteCuota.create({
          data: {
            comprobanteId,
            numero: 0,
            monto: comprobante.total,
            fechaVencimiento: comprobante.fechaEmision,
          }
        });
        cuotas = [nuevaCuota];
      }

      const montoPago = Number(data.monto);

      // 1. Registrar el pago principal
      const nuevoPago = await tx.pago.create({
        data: {
          comprobanteId,
          cuentaId: Number(data.cuentaId),
          clienteId: comprobante.clienteId,
          fechaPago: new Date(data.fechaPago),
          metodoPago: data.metodoPago,
          referencia: data.referencia,
          monto: montoPago,
          montoAplicado: 0, // Se actualizará abajo
          archivoUrl: data.archivoUrl
        }
      });

      // 2. Aplicar el pago a las cuotas (FIFO)
      let montoRestante = montoPago;
      let totalAplicado = 0;

      for (const cuota of cuotas) {
        if (montoRestante <= 0) break;

        const deudaCuota = Number(cuota.monto) - Number(cuota.montoPagado);
        if (deudaCuota <= 0) continue;

        const aplicar = Math.min(montoRestante, deudaCuota);
        
        // Crear la aplicación
        await tx.pagoAplicacion.create({
          data: {
            pagoId: nuevoPago.id,
            cuotaId: cuota.id,
            monto: aplicar
          }
        });

        // Actualizar la cuota
        const nuevoMontoPagado = Number(cuota.montoPagado) + aplicar;
        await tx.comprobanteCuota.update({
          where: { id: cuota.id },
          data: { 
            montoPagado: nuevoMontoPagado,
            estado: nuevoMontoPagado >= Number(cuota.monto) ? 'PAGADO' : 'PENDIENTE'
          }
        });

        montoRestante -= aplicar;
        totalAplicado += aplicar;
      }

      // 3. Actualizar el monto aplicado en el Pago
      await tx.pago.update({
        where: { id: nuevoPago.id },
        data: { montoAplicado: totalAplicado }
      });

      // 4. Si sobra dinero (Anticipo / Saldo a favor)
      if (montoRestante > 0) {
        await tx.clienteSaldo.upsert({
          where: { clienteId: comprobante.clienteId },
          update: { saldoAFavor: { increment: montoRestante } },
          create: { clienteId: comprobante.clienteId, saldoAFavor: montoRestante }
        });
      }

      // 5. Recalcular estado global del comprobante
      await this.recalcularEstadoPagoTx(tx, comprobanteId);

      return nuevoPago;
    });
  }

  async eliminarPago(pagoId: number) {
    return await this.db.$transaction(async (tx) => {
      const pago = await tx.pago.findUnique({ 
        where: { id: pagoId },
        include: { aplicaciones: true, comprobante: true } 
      });
      if (!pago) throw new NotFoundException('Pago no encontrado');

      // 1. Revertir montos en las cuotas
      for (const app of pago.aplicaciones) {
        if (app.cuotaId) {
          const cuota = await tx.comprobanteCuota.findUnique({ where: { id: app.cuotaId } });
          if (cuota) {
            const nuevoMontoPagado = Number(cuota.montoPagado) - Number(app.monto);
            await tx.comprobanteCuota.update({
              where: { id: cuota.id },
              data: {
                montoPagado: nuevoMontoPagado,
                estado: nuevoMontoPagado >= Number(cuota.monto) ? 'PAGADO' : 'PENDIENTE'
              }
            });
          }
        }
      }

      // 2. Revertir saldo a favor si hubo sobrepago
      const sobrepago = Number(pago.monto) - Number(pago.montoAplicado);
      if (sobrepago > 0) {
        await tx.clienteSaldo.update({
          where: { clienteId: pago.clienteId },
          data: { saldoAFavor: { decrement: sobrepago } }
        });
      }

      // 3. Eliminar el pago (las aplicaciones se borran por Cascade)
      await tx.pago.delete({ where: { id: pagoId } });
      
      // 4. Recalcular estado
      await this.recalcularEstadoPagoTx(tx, pago.comprobanteId);

      return { message: 'Pago eliminado y revertido correctamente' };
    });
  }

  private async recalcularEstadoPagoTx(tx: any, comprobanteId: string) {
    const comprobante = await tx.comprobante.findUnique({
      where: { id: comprobanteId },
      include: { cuotas: true }
    });
    if (!comprobante) return;

    // Calculamos en base a las cuotas
    const totalPagado = comprobante.cuotas.reduce((sum: number, c: any) => sum + Number(c.montoPagado), 0);
    const estadoPago = totalPagado >= Number(comprobante.total) ? 'PAGADO' : 'POR_COBRAR';

    await tx.comprobante.update({
      where: { id: comprobanteId },
      data: { estadoPago }
    });
  }
}
