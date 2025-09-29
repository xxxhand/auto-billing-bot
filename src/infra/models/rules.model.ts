import { IsString, IsBoolean, IsOptional, IsObject } from 'class-validator';

export interface IRulesModel {
  id: string;
  name: string;
  description?: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateRulesDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  conditions: Record<string, any>;

  @IsObject()
  actions: Record<string, any>;

  @IsOptional()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRulesDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;

  @IsOptional()
  @IsObject()
  actions?: Record<string, any>;

  @IsOptional()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}