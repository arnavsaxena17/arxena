import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GoogleSerpSearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
