import { Type } from 'class-transformer';
import {
    IsEmail,
    IsISO8601,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    ValidateNested,
} from 'class-validator';

export class CalendlyResourceUriDto {
  @IsOptional()
  @IsUrl({ require_protocol: true })
  uri?: string;
}

export class CalendlyBookingPayloadDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CalendlyResourceUriDto)
  event?: CalendlyResourceUriDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CalendlyResourceUriDto)
  invitee?: CalendlyResourceUriDto;
}

export class CalendlyBookingCompletedDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  company?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  calendlyEventUri?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  calendlyInviteeUri?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CalendlyBookingPayloadDto)
  calendlyPayload?: CalendlyBookingPayloadDto;
}
