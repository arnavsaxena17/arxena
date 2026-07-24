import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class CandidateEducationDetailDto {
  @IsOptional()
  @IsString()
  institute?: string;

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsNumber()
  year?: number;
}

class CandidateEmploymentRecordDto {
  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

class CandidateEducationWrapperDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateEducationDetailDto)
  ug?: CandidateEducationDetailDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateEducationDetailDto)
  pg?: CandidateEducationDetailDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateEducationDetailDto)
  ppg?: CandidateEducationDetailDto | null;
}

class CandidateEmploymentWrapperDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateEmploymentRecordDto)
  current?: CandidateEmploymentRecordDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateEmploymentRecordDto)
  previous?: CandidateEmploymentRecordDto | null;
}

class CandidateCtcInfoDto {
  @IsOptional()
  @IsString()
  lacs?: string;

  @IsOptional()
  @IsString()
  thousands?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

class CandidateExperienceInfoDto {
  @IsOptional()
  @IsNumber()
  years?: number;

  @IsOptional()
  @IsNumber()
  months?: number;
}

class CandidateStructuredFieldsDto {
  @IsOptional()
  @IsString()
  jsUserName?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  keySkills?: string;

  @IsOptional()
  @IsString()
  focusedSkills?: string;

  @IsOptional()
  @IsString()
  interestedSkills?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateEducationWrapperDto)
  education?: CandidateEducationWrapperDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateEmploymentWrapperDto)
  employment?: CandidateEmploymentWrapperDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateCtcInfoDto)
  ctcInfo?: CandidateCtcInfoDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateExperienceInfoDto)
  experience?: CandidateExperienceInfoDto | null;

  @IsOptional()
  @IsString()
  currentLocation?: string;

  @IsOptional()
  @IsString()
  preferredLocations?: string;

  @IsOptional()
  @IsBoolean()
  salaryDisclosed?: boolean;

  @IsOptional()
  @IsBoolean()
  immediateAvailabilty?: boolean;

  @IsOptional()
  @IsString()
  avgResponseTime?: string;

  @IsOptional()
  @IsNumber()
  noticePeriod?: number;

  @IsOptional()
  @IsString()
  modifyDateLabel?: string;

  @IsOptional()
  @IsString()
  activeDateLabel?: string;
}

export class CandidateDataDto {
  @IsOptional()
  @IsString()
  candidateId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  currentTitle?: string;

  @IsOptional()
  @IsString()
  currentCompany?: string;

  @IsOptional()
  @IsString()
  currentLocation?: string;

  @IsOptional()
  @IsString()
  preferredLocation?: string;

  @IsOptional()
  @IsNumber()
  totalExperienceYears?: number;

  @IsOptional()
  @IsString()
  currentCompensation?: string;

  @IsOptional()
  @IsString()
  expectedCompensation?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  education?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  achievements?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateStructuredFieldsDto)
  structuredFields?: CandidateStructuredFieldsDto;
}

export class SearchExpectationsDto {
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  salary?: string;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  skills?: string;

  @IsOptional()
  @IsString()
  certifications?: string;

  @IsOptional()
  @IsString()
  languages?: string;

  @IsOptional()
  @IsString()
  shortlistingCriteria?: string;
}

export class EvaluateShortlistDto {
  @IsString()
  naturalLanguageQuery: string;

  @ValidateNested()
  @Type(() => CandidateDataDto)
  candidate: CandidateDataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SearchExpectationsDto)
  expectations?: SearchExpectationsDto;
}


