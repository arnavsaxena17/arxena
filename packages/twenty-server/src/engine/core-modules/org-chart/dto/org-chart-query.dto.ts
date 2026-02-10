import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class OrgChartQueryDto {
  @IsObject()
  query: Record<string, unknown>;

  @IsObject()
  params: Record<string, unknown>;

  @IsOptional()
  @IsString()
  selected_context_menu?: string;

  @IsOptional()
  @IsArray()
  selected_nodes?: unknown[];

  @IsOptional()
  @IsString()
  selected_blocks?: string;
}
