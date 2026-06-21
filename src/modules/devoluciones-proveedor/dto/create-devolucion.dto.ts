import { IsNotEmpty, IsString, IsArray, ValidateNested, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class DevolucionProveedorDetalleDto {
  @IsNumber()
  @IsNotEmpty()
  productoId: number;

  @IsNumber()
  @IsNotEmpty()
  cantidad: number;

  @IsNumber()
  @IsNotEmpty()
  precioCompra: number;
}

export class CreateDevolucionProveedorDto {
  @IsNumber()
  @IsNotEmpty()
  proveedorId: number;

  @IsUUID()
  @IsNotEmpty()
  almacenId: string;

  @IsString()
  @IsNotEmpty()
  motivo: string;

  @IsString()
  @IsOptional()
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevolucionProveedorDetalleDto)
  detalles: DevolucionProveedorDetalleDto[];
}
