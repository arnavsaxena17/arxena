import { BILLING_FEATURE_POLICIES } from 'src/engine/core-modules/billing/constants/billing-feature-policy.constant';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';

describe('BILLING_FEATURE_POLICIES', () => {
  it('should cover every usage operation type so none can be charged without a policy', () => {
    const coveredOperationTypes = new Set(
      Object.values(BILLING_FEATURE_POLICIES).map(
        (policy) => policy.operationType,
      ),
    );

    Object.values(UsageOperationType).forEach((operationType) => {
      expect(coveredOperationTypes).toContain(operationType);
    });
  });

  it('should use a positive margin for every feature', () => {
    Object.entries(BILLING_FEATURE_POLICIES).forEach(([, policy]) => {
      expect(policy.marginMultiplier).toBeGreaterThan(0);
    });
  });

  it('should keep the margins that were already in force before the registry', () => {
    expect(BILLING_FEATURE_POLICIES.EMAIL_SEND.marginMultiplier).toBe(3);
    expect(BILLING_FEATURE_POLICIES.BRIGHT_DATA_SEARCH.marginMultiplier).toBe(
      1,
    );
  });

  it('should charge every feature to the customer by default', () => {
    Object.values(BILLING_FEATURE_POLICIES).forEach((policy) => {
      expect(policy.treatment).toBe('CUSTOMER');
    });
  });
});
