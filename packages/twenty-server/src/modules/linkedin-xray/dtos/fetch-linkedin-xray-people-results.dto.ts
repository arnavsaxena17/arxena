import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class FetchLinkedinXrayPeopleResultsDto {
  @IsString()
  rawQuery!: string;

  @IsOptional()
  @IsString()
  @IsIn(['google', 'bing', 'both'])
  searchEngine?: 'google' | 'bing' | 'both';

  @IsOptional()
  @IsBoolean()
  includePaginatedHtml?: boolean;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsString()
  jobName?: string;
}
