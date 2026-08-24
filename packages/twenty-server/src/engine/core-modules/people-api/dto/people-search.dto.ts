import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import type { PeopleDataSourceAlias } from '../constants/people-data-source-aliases';
import { PEOPLE_DATA_SOURCE_CATEGORIES } from '../constants/people-data-source-aliases';
import {
  PEOPLE_TAXONOMY_FUNCTION_ROOT_VALUES,
  PEOPLE_TAXONOMY_GRADE_VALUES,
  type PeopleTaxonomyFunctionRoot,
  type PeopleTaxonomyGrade,
} from '../constants/taxonomy-constants';
import { toOptionalNormalizedTaxonomyLabel } from '../utils/normalize-taxonomy-label.util';

const DATA_SOURCE_ALIASES = PEOPLE_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);

export class PeopleSearchDto {
  @IsOptional()
  @IsIn(DATA_SOURCE_ALIASES)
  dataSource?: PeopleDataSourceAlias;

  @IsOptional()
  @IsString()
  accountId?: string;

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
  linkedinCompanyUrl?: string;

  @IsOptional()
  @Transform(toOptionalNormalizedTaxonomyLabel)
  @IsString()
  stdFunction?: string;

  @IsOptional()
  @Transform(toOptionalNormalizedTaxonomyLabel)
  @IsIn(PEOPLE_TAXONOMY_FUNCTION_ROOT_VALUES)
  stdFunctionRoot?: PeopleTaxonomyFunctionRoot;

  @IsOptional()
  @Transform(toOptionalNormalizedTaxonomyLabel)
  @IsIn(PEOPLE_TAXONOMY_GRADE_VALUES)
  stdGrade?: PeopleTaxonomyGrade;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  naturalLanguage?: string;

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
  @IsString()
  searchUrl?: string;

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
