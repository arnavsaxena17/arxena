import { IsOptional, IsString } from 'class-validator';

export class ExpandJobTitlesDto {
  @IsString()
  jobTitle!: string;

  @IsOptional()
  @IsString()
  companyName?: string;
}
