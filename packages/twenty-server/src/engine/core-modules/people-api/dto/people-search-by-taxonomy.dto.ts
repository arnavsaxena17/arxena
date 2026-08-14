import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import {
  PEOPLE_LINKEDIN_DATA_SOURCES,
  type PeopleLinkedInDataSource,
} from '../constants/people-data-source-aliases';
import {
  PEOPLE_TAXONOMY_FUNCTION_ROOT_VALUES,
  PEOPLE_TAXONOMY_GRADE_VALUES,
  type PeopleTaxonomyFunctionRoot,
  type PeopleTaxonomyGrade,
} from '../constants/taxonomy-constants';
import { toOptionalNormalizedTaxonomyLabel } from '../utils/normalize-taxonomy-label.util';

export {
  PEOPLE_TAXONOMY_GRADE_VALUES,
  type PeopleTaxonomyGrade,
} from '../constants/taxonomy-constants';

export class PeopleSearchByTaxonomyDto {
  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

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
  @IsIn(PEOPLE_LINKEDIN_DATA_SOURCES)
  dataSource?: PeopleLinkedInDataSource;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
