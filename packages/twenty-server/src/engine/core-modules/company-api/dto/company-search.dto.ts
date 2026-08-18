import {
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
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
