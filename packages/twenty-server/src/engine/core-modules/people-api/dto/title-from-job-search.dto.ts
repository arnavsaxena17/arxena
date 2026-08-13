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
import {
  PEOPLE_SALES_NAV_CANDIDATE_SOURCES,
  type PeopleSalesNavCandidateSourceDto,
} from './people-search.dto';

const DATA_SOURCE_ALIASES = PEOPLE_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);

export class TitleFromJobSearchDto {
  @IsString()
  jobTitle!: string;

  @IsOptional()
  @IsIn(DATA_SOURCE_ALIASES)
  dataSource?: PeopleDataSourceAlias;

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
  companyId?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  country?: string;

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
