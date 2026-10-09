/* @license Enterprise */

import { type BillingFeature } from 'src/engine/core-modules/billing/constants/billing-feature-policy.constant';

// Who a metered call is charged to and which feature it counts as
export type MeteringContext = {
  workspaceId: string;
  feature: BillingFeature;
  userWorkspaceId?: string | null;
  resourceId?: string | null;
  // 'workspace' when the call runs on the customer's own provider key. They pay
  // the provider directly, so it is recorded but not charged in credits.
  keySource?: 'platform' | 'workspace';
};
