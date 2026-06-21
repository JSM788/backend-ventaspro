export class CrearTrasladoDto {
  almacenOrigenId: string;
  almacenDestinoId: string;
  observaciones?: string;
  responsableEnvioId?: string;
  detalles: Array<{
    productoId: number;
    cantidadEnviada: number;
  }>;
}
