import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  LINKEDIN_XRAY_COUNTRIES,
  LINKEDIN_XRAY_EDUCATION_LEVELS,
} from 'src/modules/linkedin-xray/constants/linkedin-xray-options';

const COUNTRY_VALUES = LINKEDIN_XRAY_COUNTRIES.map((country) => country.value);
const EDUCATION_VALUES = LINKEDIN_XRAY_EDUCATION_LEVELS.map(
  (education) => education.value,
);

export class BuildLinkedinXrayDto {
  @IsOptional()
  @IsString()
  @IsIn(COUNTRY_VALUES)
  country?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  includeKeywords?: string;

  @IsOptional()
  @IsString()
  locationOrKeywords?: string;

  @IsOptional()
  @IsString()
  excludeKeywords?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeKeywordsList?: string[];

  @IsOptional()
  @IsString()
  @IsIn(EDUCATION_VALUES)
  education?: string;

  @IsOptional()
  @IsString()
  currentEmployer?: string;
}
