import { 
  Controller, 
  Get, 
  Post, 
  Put,
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
import { CreateProductoDto, UpdateProductoDto } from './dto/producto.dto';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';

@Controller('v1/productos')
export class ProductosController {
  constructor(
    private readonly productosService: ProductosService,
    private readonly storageService: StorageService
  ) {}

  @Get()
  getAll(@CurrentTenant() empresaId: string) {
    return this.productosService.findAll(empresaId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentTenant() empresaId: string) {
    return this.productosService.findOne(id, empresaId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async create(
    @CurrentTenant() empresaId: string,
    @Body() data: CreateProductoDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    // Si viene la data como formData (multipart/form-data), vendrá en texto plano
    // y necesitaremos parsearla en caso hayan booleanos, pero para empezar lo dejamos así.
    
    const producto = await this.productosService.create(empresaId, data);
    
    // Si subió imagen, la guardamos
    if (file) {
      if (!file.mimetype.match(/^image\/(jpg|jpeg|png|webp|gif)$/i)) {
        throw new BadRequestException('Archivo no permitido. Debe ser una imagen.');
      }
      const ext = file.originalname.split('.').pop();
      const filename = `producto-${producto.id}.${ext}`;
      
      const tenantKey = `${producto.empresa.slug}-${producto.empresaId.substring(0, 8)}`;
      const uploadResult = await this.storageService.upload(
        'public',
        tenantKey,
        'productos',
        filename,
        file.buffer,
        file.mimetype,
        false // No usar carpetas de fechas para imágenes de productos
      );
      
      // Actualizamos el producto con el url de la imagen guardada
      await this.productosService.updateImageUrl(producto.id, empresaId, uploadResult.url);
    }
    
    return { success: true, productoId: producto.id };
  }

  @Put(':id')
  update(@CurrentTenant() empresaId: string, @Param('id', ParseIntPipe) id: number, @Body() data: UpdateProductoDto) {
    return this.productosService.update(id, empresaId, data);
  }

  @Delete(':id')
  remove(@CurrentTenant() empresaId: string, @Param('id', ParseIntPipe) id: number) {
    return this.productosService.remove(id, empresaId);
  }
}
