import { registerEnumType } from '@nestjs/graphql';

export enum OnboardingIntentPath {
  COMPETITIVE_RESEARCH = 'COMPETITIVE_RESEARCH',
  CORPORATE_TA = 'CORPORATE_TA',
  DEAL_DILIGENCE = 'DEAL_DILIGENCE',
  EXTENSION_INSTALL = 'EXTENSION_INSTALL',
}

registerEnumType(OnboardingIntentPath, {
  name: 'OnboardingIntentPath',
});
