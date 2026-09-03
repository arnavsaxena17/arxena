import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export const TAXONOMY_CLASSIFY_LLM_MAX = 200;

export class TaxonomyClassifyLlmDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(TAXONOMY_CLASSIFY_LLM_MAX)
  job_titles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(TAXONOMY_CLASSIFY_LLM_MAX)
  profiles?: string[];
}
