/* @license Enterprise */

export enum BillingEntitlementKey {
  SSO = 'SSO',
  CUSTOM_DOMAIN = 'CUSTOM_DOMAIN',
  RLS = 'RLS',
  AUDIT_LOGS = 'AUDIT_LOGS',
}

// Entitlements available on every plan (skip Stripe / enterprise checks)
export const FREE_BILLING_ENTITLEMENT_KEYS: BillingEntitlementKey[] = [
  BillingEntitlementKey.CUSTOM_DOMAIN,
  BillingEntitlementKey.RLS,
  BillingEntitlementKey.AUDIT_LOGS,
];

export const isFreeBillingEntitlement = (
  key: BillingEntitlementKey,
): boolean => FREE_BILLING_ENTITLEMENT_KEYS.includes(key);
