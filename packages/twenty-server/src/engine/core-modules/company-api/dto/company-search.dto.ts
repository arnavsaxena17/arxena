import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import type { CompanyDataSourceAlias } from '../constants/company-data-source-aliases';
import { COMPANY_DATA_SOURCE_CATEGORIES } from '../constants/company-data-source-aliases';

const DATA_SOURCE_ALIASES = COMPANY_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);

export class CompanySearchDto {
  @IsOptional()
  @IsIn(DATA_SOURCE_ALIASES)
  dataSource?: CompanyDataSourceAlias;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === 1 || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === 0 || value === '0') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  useV2?: boolean;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: string;

  @IsOptional()
  @IsNumber()
  lastViewedAt?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
