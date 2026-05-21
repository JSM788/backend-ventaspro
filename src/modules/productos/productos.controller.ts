import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProductosService } from './productos.service';
import { StorageService } from '../../core/storage/storage.interface';

@Controller('productos')
export class ProductosController {
  constructor(
    private readonly productosService: ProductosService,
    private readonly storageService: StorageService
  ) {}

  @Get()
  getAll() {
    return this.productosService.findAll();
  }

  @Post()
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async create(
    @Body() data: any,
    @UploadedFile() file?: Express.Multer.File
  ) {
    // Si viene la data como formData (multipart/form-data), vendrá en texto plano
    // y necesitaremos parsearla en caso hayan booleanos, pero para empezar lo dejamos así.
    
    const producto = await this.productosService.create(data);
    
    // Si subió imagen, la guardamos
    if (file) {
      if (!file.mimetype.match(/^image\/(jpg|jpeg|png|webp|gif)$/i)) {
        throw new BadRequestException('Archivo no permitido. Debe ser una imagen.');
      }
      const ext = file.originalname.split('.').pop();
      const filename = `producto-${producto.id}.${ext}`;
      
      const uploadResult = await this.storageService.upload(
        'productos',
        producto.empresaId, // entityId = empresa
        filename,
        file.buffer,
        file.mimetype
      );
      
      // Actualizamos el producto con el url de la imagen guardada
      await this.productosService.updateImageUrl(producto.id, uploadResult.path);
    }
    
    return { success: true, productoId: producto.id };
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.remove(id);
  }
}
