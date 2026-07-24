import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import type { PeopleDataSourceAlias } from '../constants/people-data-source-aliases';
import { PEOPLE_DATA_SOURCE_CATEGORIES } from '../constants/people-data-source-aliases';

const DATA_SOURCE_ALIASES = PEOPLE_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);

export class PeopleSearchDto {
  @IsOptional()
  @IsIn(DATA_SOURCE_ALIASES)
  dataSource?: PeopleDataSourceAlias;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  stdFunction?: string;

  @IsOptional()
  @IsString()
  stdGrade?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  personName?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}
