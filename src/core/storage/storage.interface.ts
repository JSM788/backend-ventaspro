export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Contrato que todo proveedor de almacenamiento debe implementar.
 * Hoy: disco local. Mañana: Supabase Storage, Cloudflare R2, S3, etc.
 * El código que usa este servicio NO cambia al migrar de proveedor.
 */
export abstract class StorageService {
  /**
   * Sube un archivo al almacenamiento.
   * @param context  Contexto del módulo: 'empresas' | 'productos' | 'tienda' | 'usuarios'
   * @param entityId ID de la entidad dueña del archivo
   * @param filename Nombre del archivo (sin extensión, se guarda como .webp)
   * @param buffer   Buffer con el contenido del archivo
   * @param mimetype MIME type original del archivo
   */
  abstract upload(
    context: string,
    entityId: string,
    filename: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<UploadResult>;

  /**
   * Elimina un archivo del almacenamiento por su path relativo.
   * @param path Path relativo retornado por upload() (ej: 'empresas/uuid/logo-claro.webp')
   */
  abstract delete(path: string): Promise<void>;
}
