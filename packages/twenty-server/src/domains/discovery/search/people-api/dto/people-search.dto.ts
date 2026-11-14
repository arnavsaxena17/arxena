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
import { PEOPLE_SEARCH_MAX_LIMIT } from '../constants/people-search-limits';
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
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(['ludicrous', 'smart', 'instant'])
  mode?: 'ludicrous' | 'smart' | 'instant';

  // Ludicrous only: spend cap in USD for this query (max 10, default 1)
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10)
  maxBudgetUsd?: number;

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
  searchUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(PEOPLE_SEARCH_MAX_LIMIT)
  limit?: number;
}
