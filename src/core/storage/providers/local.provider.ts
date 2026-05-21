import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { writeFile } from 'fs/promises';
import sharp from 'sharp';
import { StorageService, UploadResult } from '../storage.interface';


/**
 * Proveedor LOCAL de almacenamiento.
 * Guarda imágenes en disco dentro de /uploads/{context}/{entityId}/{filename}.webp
 * Todas las imágenes se convierten a WebP para reducir el peso ~70%.
 *
 * Para migrar a Supabase o Cloudflare R2:
 * 1. Crea supabase.provider.ts o cloudflare.provider.ts con la misma interfaz.
 * 2. Cambia STORAGE_PROVIDER en tu .env.
 * 3. El resto del código (controladores, servicios) NO CAMBIA.
 */
@Injectable()
export class LocalStorageProvider extends StorageService {
  private readonly logger = new Logger(LocalStorageProvider.name);
  // Carpeta raíz donde se guardan todos los uploads
  private readonly uploadRoot = join(process.cwd(), 'uploads');

  async upload(
    context: string,
    entityId: string,
    filename: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<UploadResult> {
    // Ruta final: uploads/empresas/{uuid}/logo-claro.webp
    const folder = join(this.uploadRoot, context, entityId);
    const finalFilename = `${filename}.webp`;
    const absolutePath = join(folder, finalFilename);
    const relativePath = `${context}/${entityId}/${finalFilename}`;

    // Crear la carpeta si no existe (mkdirSync con recursive es seguro)
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true });
    }

    // Convertir a WebP con sharp (calidad 85 = buen balance peso/calidad)
    const webpBuffer = await sharp(buffer)
      .webp({ quality: 85 })
      .toBuffer();

    await writeFile(absolutePath, webpBuffer);
    this.logger.log(`Imagen guardada: ${relativePath}`);

    return {
      path: relativePath,
      url: `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/uploads/${relativePath}`,
    };
  }

  async delete(path: string): Promise<void> {
    const absolutePath = join(this.uploadRoot, path);
    if (existsSync(absolutePath)) {
      unlinkSync(absolutePath);
      this.logger.log(`Imagen eliminada: ${path}`);
    }
  }
}
