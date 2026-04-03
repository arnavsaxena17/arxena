import { IsString } from 'class-validator';

export class ParseLinkedinXrayDto {
  @IsString()
  rawQuery!: string;
}
