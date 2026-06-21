import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class BaseProductoDto {
  @IsOptional()
  @IsString()
  tipo?: string;

  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber()
  unidadBaseId?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber()
  precioUnitario?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  incluyeIgv?: boolean;

  @IsOptional()
  @IsString()
  tipoAfectacion?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber()
  stock?: number;
  
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber()
  stockInicial?: number;

  @IsOptional()
  @IsString()
  codigoInterno?: string;

  @IsOptional()
  @IsString()
  codigoSunat?: string;

  @IsOptional()
  @IsString()
  imagenUrl?: string;

  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  // Campos E-commerce y Tienda Virtual
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber()
  precioOriginal?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  publicarEnTienda?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  mostrarStockEnTienda?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  destacado?: boolean;

  // Control de Inventario
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  controlarStock?: boolean;
}

export class CreateProductoDto extends BaseProductoDto {}

export class UpdateProductoDto extends PartialType(BaseProductoDto) {}
