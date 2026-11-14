import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class RunAgent1Dto {
  @IsString()
  rawRequirement: string;

  @IsOptional()
  @IsString()
  queryIpLocation?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;
}

export class GenerateQuerySetDto {
  @IsString()
  rawRequirement: string;

  @IsOptional()
  @IsString()
  queryIpLocation?: string;

  @IsOptional()
  @IsBoolean()
  verbose?: boolean;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;
}

export class GenerateQuerySetBatchDto {
  @IsArray()
  @IsString({ each: true })
  requirements: string[];

  @IsOptional()
  @IsString()
  queryIpLocation?: string;

  @IsOptional()
  @IsBoolean()
  verbose?: boolean;

  @IsOptional()
  @IsBoolean()
  parallel?: boolean;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;
}
