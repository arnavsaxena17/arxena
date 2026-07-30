import { useQuery } from '@apollo/client/react';
import { isDefined } from 'twenty-shared/utils';
import {
  BillingProductKey,
  GetResourceCreditUsageDocument,
} from '~/generated-metadata/graphql';

export const useGetResourceCreditUsage = () => {
  const { data, loading, refetch } = useQuery(GetResourceCreditUsageDocument);

  const refetchResourceCreditUsage = () => {
    refetch();
  };

  const isGetResourceCreditUsageQueryLoaded = () => {
    return isDefined(data?.getResourceCreditUsage) && !loading;
  };

  const resourceCreditUsage = data?.getResourceCreditUsage?.find(
    (productUsage) =>
      productUsage.productKey === BillingProductKey.RESOURCE_CREDIT,
  );

  const hasResourceCreditUsage = isDefined(resourceCreditUsage);

  const getResourceCreditUsage = () => {
    if (!data) {
      throw new Error('getResourceCreditUsage was not loaded');
    }

    if (!isDefined(resourceCreditUsage)) {
      throw new Error('RESOURCE_CREDIT usage not found');
    }

    return resourceCreditUsage;
  };

  return {
    refetchResourceCreditUsage,
    isGetResourceCreditUsageQueryLoaded: isGetResourceCreditUsageQueryLoaded(),
    hasResourceCreditUsage,
    getResourceCreditUsage,
  };
};
