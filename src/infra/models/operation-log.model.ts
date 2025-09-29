import { IsString, IsOptional } from 'class-validator';

export interface IOperationLogModel {
  id: string;
  subscriptionId: string;
  operatorId: string;
  action: string;
  details?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export class CreateOperationLogDto {
  @IsString()
  subscriptionId: string;

  @IsString()
  operatorId: string;

  @IsString()
  action: string;

  @IsOptional()
  details?: Record<string, any>;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}
