import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

const FREE_TRIAL_SOURCES = [
  'homepage_hero',
  'header',
  'header_mobile',
  'org_chart_banner',
  'org_chart_node_modal',
] as const;

export type FreeTrialLeadSource = (typeof FREE_TRIAL_SOURCES)[number];

export class FreeTrialOrgChartContextDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  selectedCountry?: string;

  @IsOptional()
  @IsString()
  selectedFunctionRoot?: string;

  @IsOptional()
  @IsString()
  nodeHeadline?: string;
}

export class FreeTrialLeadDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  company: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsIn(FREE_TRIAL_SOURCES)
  source: FreeTrialLeadSource;

  @IsOptional()
  @ValidateNested()
  @Type(() => FreeTrialOrgChartContextDto)
  orgChartContext?: FreeTrialOrgChartContextDto;
}
