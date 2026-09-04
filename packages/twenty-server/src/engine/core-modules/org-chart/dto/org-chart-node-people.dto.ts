import { IsNumber, IsOptional, IsString } from 'class-validator';

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
  @IsNumber()
  nodeKey?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

