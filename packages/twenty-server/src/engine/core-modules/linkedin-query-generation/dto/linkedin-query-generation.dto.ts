import {
    IsArray,
    IsBoolean,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
} from 'class-validator';

import {
    FactoredQuery,
    MasterLists,
    ParsedRequirement,
    PrimaryQuery,
    SearchQuerySet,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

export class RunAgent1Dto {
  @IsString()
  rawRequirement: string;

  @IsOptional()
  @IsString()
  queryIpLocation?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;
}

export class RunAgent2Dto {
  @IsObject()
  parsedRequirement: ParsedRequirement;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;
}

export class RunAgent3Dto {
  @IsObject()
  parsedRequirement: ParsedRequirement;

  @IsObject()
  masterLists: MasterLists;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;
}

export class RunAgent5Dto {
  @IsObject()
  parsedRequirement: ParsedRequirement;

  @IsObject()
  primaryQuery: PrimaryQuery;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;
}

export class GenerateQuerySetDto {
  @IsString()
  rawRequirement: string;

  @IsOptional()
  @IsString()
  queryIpLocation?: string;

  @IsOptional()
  @IsBoolean()
  verbose?: boolean;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;
}

export class GenerateQuerySetBatchDto {
  @IsArray()
  @IsString({ each: true })
  requirements: string[];

  @IsOptional()
  @IsString()
  queryIpLocation?: string;

  @IsOptional()
  @IsBoolean()
  verbose?: boolean;

  @IsOptional()
  @IsBoolean()
  parallel?: boolean;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;
}

export class ValidateQuerySetDto {
  @IsObject()
  querySet: SearchQuerySet;
}
