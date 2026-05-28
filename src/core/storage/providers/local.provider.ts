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
    visibility: 'public' | 'private' | 'temp',
    tenantKey: string,
    modulePath: string,
    filename: string,
    buffer: Buffer,
    mimetype: string,
    useDateNesting?: boolean,
  ): Promise<UploadResult> {
    const isImage = mimetype.startsWith('image/') && mimetype !== 'image/svg+xml';
    const finalFilename = isImage ? `${filename.split('.')[0] || filename}.webp` : filename;

    let relativeFolder = join(visibility, tenantKey, modulePath);
    
    if (useDateNesting) {
      const date = new Date();
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      relativeFolder = join(relativeFolder, year, month, day);
    }

    const folder = join(this.uploadRoot, relativeFolder);
    const absolutePath = join(folder, finalFilename);
    const relativePath = join(relativeFolder, finalFilename).replace(/\\/g, '/');

    // Crear la carpeta si no existe (mkdirSync con recursive es seguro)
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true });
    }

    let finalBuffer = buffer;
    
    // Solo convertimos a WebP si es una imagen válida
    if (isImage) {
      try {
        finalBuffer = await sharp(buffer)
          .webp({ quality: 85 })
          .toBuffer();
      } catch (err) {
        this.logger.warn(`No se pudo optimizar la imagen ${filename}, guardando original. Error: ${err.message}`);
      }
    }

    await writeFile(absolutePath, finalBuffer);
    this.logger.log(`Archivo guardado localmente: ${relativePath}`);

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
