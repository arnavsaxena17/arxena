import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class OutreachTabDto {
  @IsIn(['export', 'dedupe'])
  action: 'export' | 'dedupe';

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsIn(['companies', 'people'])
  tab: 'companies' | 'people';

  @IsOptional()
  @IsIn(['crm'])
  against?: 'crm';

  @IsOptional()
  @IsBoolean()
  remove?: boolean;
}
