import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import type { PostDataSourceAlias } from '../constants/post-data-source-aliases';
import { POST_DATA_SOURCE_CATEGORIES } from '../constants/post-data-source-aliases';

const DATA_SOURCE_ALIASES = POST_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);

const SORT_BY_VALUES = ['relevance', 'date'] as const;
const DATE_POSTED_VALUES = ['past_day', 'past_week', 'past_month'] as const;
const CONTENT_TYPE_VALUES = [
  'videos',
  'images',
  'live_videos',
  'collaborative_articles',
  'documents',
] as const;

export class PostSearchDto {
  @IsOptional()
  @IsIn(DATA_SOURCE_ALIASES)
  dataSource?: PostDataSourceAlias;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsIn(SORT_BY_VALUES)
  sortBy?: (typeof SORT_BY_VALUES)[number];

  @IsOptional()
  @IsIn(DATE_POSTED_VALUES)
  datePosted?: (typeof DATE_POSTED_VALUES)[number];

  @IsOptional()
  @IsIn(CONTENT_TYPE_VALUES)
  contentType?: (typeof CONTENT_TYPE_VALUES)[number];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
