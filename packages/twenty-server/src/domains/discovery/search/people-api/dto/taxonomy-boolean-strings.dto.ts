import { IsOptional, IsString } from 'class-validator';

export class TaxonomyBooleanStringsDto {
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
  @IsString()
  companyName?: string;
}
