import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.interface';
import { LocalStorageProvider } from './providers/local.provider';

/**
 * Módulo global de almacenamiento.
 * Inyecta automáticamente el proveedor correcto según STORAGE_PROVIDER en .env:
 *   - 'local'      → LocalStorageProvider (default, guarda en /uploads)
 *   - 'supabase'   → SupabaseStorageProvider (futuro)
 *   - 'cloudflare' → CloudflareStorageProvider (futuro)
 *
 * Al cambiar el proveedor, NINGÚN módulo que use StorageService necesita cambiar.
 */
@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      useClass: LocalStorageProvider,
      // Futuro: useFactory para inyección dinámica según process.env.STORAGE_PROVIDER
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
