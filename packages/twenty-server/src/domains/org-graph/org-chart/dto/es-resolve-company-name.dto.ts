import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class EsResolveCompanyNameDto {
  @ValidateIf(
    (body: EsResolveCompanyNameDto) =>
      !Array.isArray(body.companyNames) || body.companyNames.length === 0,
  )
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  companyNames?: string[];
}
