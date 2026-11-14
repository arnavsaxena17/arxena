import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false;
  }

  return value;
};

export class LocalBusinessSearchDto {
  @IsString()
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  zoom?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  extractEmailsAndContacts?: boolean;

  @IsOptional()
  @IsString()
  subtypes?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsString()
  businessStatus?: string;

  @IsOptional()
  @IsString()
  fields?: string;
}

export class LocalBusinessSearchNearbyDto {
  @IsString()
  query!: string;

  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  extractEmailsAndContacts?: boolean;

  @IsOptional()
  @IsString()
  subtypes?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsString()
  businessStatus?: string;

  @IsOptional()
  @IsString()
  fields?: string;
}

export class LocalBusinessSearchInAreaDto {
  @IsString()
  query!: string;

  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  zoom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  extractEmailsAndContacts?: boolean;

  @IsOptional()
  @IsString()
  subtypes?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsString()
  businessStatus?: string;

  @IsOptional()
  @IsString()
  fields?: string;
}

export class LocalBusinessDetailsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  businessIds!: string[];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  extractEmailsAndContacts?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  extractShareLink?: boolean;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  fields?: string;
}

export class LocalBusinessAutocompleteDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  region?: string;
}
