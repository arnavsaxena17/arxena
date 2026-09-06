import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class OrgChartNodePeopleDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  stdFunction?: string;

  @IsOptional()
  @IsString()
  stdGrade?: string;

  @IsOptional()
  @IsString()
  stdFunctionRoot?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  nodeKey?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
