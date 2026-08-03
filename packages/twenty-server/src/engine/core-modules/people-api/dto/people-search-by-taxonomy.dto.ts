import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const PEOPLE_TAXONOMY_GRADE_VALUES = [
  'entry',
  'mid',
  'leadership',
] as const;

export type PeopleTaxonomyGrade = (typeof PEOPLE_TAXONOMY_GRADE_VALUES)[number];

export const PEOPLE_LINKEDIN_CANDIDATE_SOURCES = [
  'harvest',
  'unipile',
] as const;

export type PeopleLinkedInCandidateSourceDto =
  (typeof PEOPLE_LINKEDIN_CANDIDATE_SOURCES)[number];

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
  @IsIn(PEOPLE_LINKEDIN_CANDIDATE_SOURCES)
  candidateSource?: PeopleLinkedInCandidateSourceDto;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
