/* @license Enterprise */

import { BRIGHT_DATA_BILLING_MARGIN_MULTIPLIER } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { type BillingTreatment } from 'src/engine/core-modules/billing/types/billing-treatment.type';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { UsageResourceType } from 'src/engine/core-modules/usage/enums/usage-resource-type.enum';
import { UsageUnit } from 'src/engine/core-modules/usage/enums/usage-unit.enum';
import { EMAIL_MARGIN_MULTIPLIER } from 'src/modules/emailing/constants/email-margin-multiplier';

export type BillingFeaturePolicy = {
  treatment: BillingTreatment;
  resourceType: UsageResourceType;
  operationType: UsageOperationType;
  unit: UsageUnit;
  // Customer price = provider cost x this. Every feature is 1.0 unless it was
  // already priced differently before the policy registry existed.
  marginMultiplier: number;
};

// One entry per billable thing. Add a feature here before charging for it, so
// its treatment and margin are decided in one reviewable place.
export const BILLING_FEATURE_POLICIES = {
  AI_CHAT: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.AI,
    operationType: UsageOperationType.AI_CHAT_TOKEN,
    unit: UsageUnit.TOKEN,
    marginMultiplier: 1,
  },
  AI_WORKFLOW: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.AI,
    operationType: UsageOperationType.AI_WORKFLOW_TOKEN,
    unit: UsageUnit.TOKEN,
    marginMultiplier: 1,
  },
  AI_BACKGROUND: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.AI,
    operationType: UsageOperationType.AI_BACKGROUND_TOKEN,
    unit: UsageUnit.TOKEN,
    marginMultiplier: 1,
  },
  JD_PARSE: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.AI,
    operationType: UsageOperationType.AI_BACKGROUND_TOKEN,
    unit: UsageUnit.TOKEN,
    marginMultiplier: 1,
  },
  RESUME_PARSE: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.AI,
    operationType: UsageOperationType.AI_BACKGROUND_TOKEN,
    unit: UsageUnit.TOKEN,
    marginMultiplier: 1,
  },
  FILTER_DESCRIPTION: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.AI,
    operationType: UsageOperationType.AI_BACKGROUND_TOKEN,
    unit: UsageUnit.TOKEN,
    marginMultiplier: 1,
  },
  AI_FILTERING: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.AI,
    operationType: UsageOperationType.AI_BACKGROUND_TOKEN,
    unit: UsageUnit.TOKEN,
    marginMultiplier: 1,
  },
  AI_TRANSCRIPTION: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.AI,
    operationType: UsageOperationType.AI_TRANSCRIPTION,
    unit: UsageUnit.MINUTE,
    marginMultiplier: 1,
  },
  AI_WEB_SEARCH: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.AI,
    operationType: UsageOperationType.WEB_SEARCH,
    unit: UsageUnit.INVOCATION,
    marginMultiplier: 1,
  },
  WORKFLOW_STEP: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.WORKFLOW,
    operationType: UsageOperationType.WORKFLOW_EXECUTION,
    unit: UsageUnit.INVOCATION,
    marginMultiplier: 1,
  },
  CODE_EXECUTION: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.LOGIC_FUNCTION,
    operationType: UsageOperationType.CODE_EXECUTION,
    unit: UsageUnit.INVOCATION,
    marginMultiplier: 1,
  },
  CALL_RECORDING: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.APP,
    operationType: UsageOperationType.CALL_RECORDING,
    unit: UsageUnit.MINUTE,
    marginMultiplier: 1,
  },
  EMAIL_SEND: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.EMAIL,
    operationType: UsageOperationType.EMAIL_SEND,
    unit: UsageUnit.INVOCATION,
    marginMultiplier: EMAIL_MARGIN_MULTIPLIER,
  },
  BRIGHT_DATA_SEARCH: {
    treatment: 'CUSTOMER',
    resourceType: UsageResourceType.API,
    operationType: UsageOperationType.BRIGHT_DATA_SEARCH,
    unit: UsageUnit.INVOCATION,
    marginMultiplier: BRIGHT_DATA_BILLING_MARGIN_MULTIPLIER,
  },
} as const satisfies Record<string, BillingFeaturePolicy>;

export type BillingFeature = keyof typeof BILLING_FEATURE_POLICIES;
