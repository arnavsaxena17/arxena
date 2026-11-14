import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import type { JobDataSourceAlias } from '../constants/job-data-source-aliases';
import { JOB_DATA_SOURCE_CATEGORIES } from '../constants/job-data-source-aliases';

const DATA_SOURCE_ALIASES = JOB_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);

export class JobSearchDto {
  @IsOptional()
  @IsIn(DATA_SOURCE_ALIASES)
  dataSource?: JobDataSourceAlias;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsNumber()
  datePosted?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
