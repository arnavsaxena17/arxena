import { IsObject, IsOptional, IsString } from 'class-validator';

export class CompanyAutocompleteDto {
  @IsString()
  input_text: string;

  @IsOptional()
  @IsObject()
  query?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
