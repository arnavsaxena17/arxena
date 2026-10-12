import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { OUTREACH_LIST_MAX_ROWS } from 'src/engine/core-modules/outreach-list/outreach-list.constants';

export class OutreachListDto {
  @IsIn([
    'list',
    'summary',
    'peek',
    'export',
    'dedupe',
    'attach',
    'save_to_crm',
    'delete',
  ])
  action:
    | 'list'
    | 'summary'
    | 'peek'
    | 'export'
    | 'dedupe'
    | 'attach'
    | 'save_to_crm'
    | 'delete';

  @IsOptional()
  @IsString()
  listId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(OUTREACH_LIST_MAX_ROWS)
  limit?: number;

  @IsOptional()
  @IsIn(['crm', 'lists'])
  against?: 'crm' | 'lists';

  @IsOptional()
  @IsBoolean()
  remove?: boolean;

  @IsOptional()
  @IsString()
  projectId?: string;
}
