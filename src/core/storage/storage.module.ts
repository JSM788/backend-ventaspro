import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.interface';
import { LocalStorageProvider } from './providers/local.provider';
import { S3Provider } from './providers/s3.provider';

/**
 * Módulo global de almacenamiento.
 * Inyecta automáticamente el proveedor correcto según STORAGE_PROVIDER en .env:
 *   - 'local'      → LocalStorageProvider (default, guarda en /uploads)
 *   - 's3' / 'r2'  → S3Provider
 *   - 'supabase'   → SupabaseStorageProvider (futuro)
 *   - 'cloudflare' → CloudflareStorageProvider (futuro)
 *
 * Al cambiar el proveedor, NINGÚN módulo que use StorageService necesita cambiar.
 */
const storageProviderFactory = {
  provide: StorageService,
  useFactory: () => {
    const provider = process.env.STORAGE_PROVIDER?.toLowerCase();
    if (provider === 'r2' || provider === 's3') {
      return new S3Provider();
    }
    return new LocalStorageProvider();
  },
};

@Global()
@Module({
  providers: [
    storageProviderFactory,
  ],
  exports: [StorageService],
})
export class StorageModule {}
