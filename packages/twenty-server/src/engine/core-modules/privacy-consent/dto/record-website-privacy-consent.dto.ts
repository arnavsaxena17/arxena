import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import {
    PRIVACY_CONSENT_ACTIONS,
    PRIVACY_POLICY_VERSION,
    type PrivacyConsentAction,
} from 'twenty-shared';

export class PrivacyConsentCategoriesDto {
  @IsBoolean()
  necessary: true;

  @IsBoolean()
  analytics: boolean;

  @IsBoolean()
  functional: boolean;
}

export class RecordWebsitePrivacyConsentDto {
  @IsUUID()
  visitorId: string;

  @IsIn(PRIVACY_CONSENT_ACTIONS)
  action: PrivacyConsentAction;

  @IsString()
  @IsNotEmpty()
  policyVersion: string = PRIVACY_POLICY_VERSION;

  @ValidateNested()
  @Type(() => PrivacyConsentCategoriesDto)
  categories: PrivacyConsentCategoriesDto;

  @IsOptional()
  @IsString()
  locale?: string;
}
