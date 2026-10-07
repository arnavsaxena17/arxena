import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class BrightDataBusinessSearchDto {
  // smart/instant are limited to 200 characters by Bright Data; ludicrous
  // plans the request itself so it may be longer
  @IsString()
  @MaxLength(2000)
  query: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(['ludicrous', 'smart', 'instant'])
  mode?: 'ludicrous' | 'smart' | 'instant';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(['full', 'summary', 'id_only'])
  view?: 'full' | 'summary' | 'id_only';

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10)
  maxBudgetUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5000)
  targetCount?: number;

  @IsOptional()
  @IsBoolean()
  autoExecute?: boolean;
}
