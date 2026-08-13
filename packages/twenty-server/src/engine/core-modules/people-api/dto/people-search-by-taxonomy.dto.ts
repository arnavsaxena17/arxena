import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import {
  PEOPLE_SALES_NAV_CANDIDATE_SOURCES,
  type PeopleSalesNavCandidateSourceDto,
} from './people-search.dto';

export const PEOPLE_TAXONOMY_GRADE_VALUES = [
  'entry',
  'mid',
  'leadership',
] as const;

export type PeopleTaxonomyGrade = (typeof PEOPLE_TAXONOMY_GRADE_VALUES)[number];

/** @deprecated Use PEOPLE_SALES_NAV_CANDIDATE_SOURCES */
export const PEOPLE_LINKEDIN_CANDIDATE_SOURCES =
  PEOPLE_SALES_NAV_CANDIDATE_SOURCES;

export type PeopleLinkedInCandidateSourceDto =
  PeopleSalesNavCandidateSourceDto;

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
  @IsString()
  stdFunction?: string;

  @IsOptional()
  @IsString()
  stdFunctionRoot?: string;

  @IsOptional()
  @IsIn(PEOPLE_TAXONOMY_GRADE_VALUES)
  stdGrade?: PeopleTaxonomyGrade;

  @IsOptional()
  @IsIn(PEOPLE_SALES_NAV_CANDIDATE_SOURCES)
  candidateSource?: PeopleSalesNavCandidateSourceDto;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  linkedInAccountId?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
