import { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';

import { ASSISTANT_APPLICATION_UNIVERSAL_IDENTIFIER } from '@/applications/constants/assistantApplication.constant';
import { FIND_MANY_APPLICATIONS } from '@/applications/graphql/queries/findManyApplications';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';

/**
 * Assistant is optional (not pre-installed). Prefer the Application row when
 * present; fall back to an active `assistantThread` object for workspaces
 * still mid-migration where legacy metadata has not been reassigned yet.
 */
export const useIsAssistantAppInstalled = (): boolean => {
  const { data } = useQuery(FIND_MANY_APPLICATIONS, {
    fetchPolicy: 'cache-first',
  });
  const { objectMetadataItems } = useObjectMetadataItems();

  return useMemo(() => {
    const applications = data?.findManyApplications ?? [];
    const hasApplication = applications.some(
      (application: { universalIdentifier?: string }) =>
        application.universalIdentifier ===
        ASSISTANT_APPLICATION_UNIVERSAL_IDENTIFIER,
    );

    if (hasApplication) {
      return true;
    }

    return objectMetadataItems.some(
      (item) => item.nameSingular === 'assistantThread' && item.isActive,
    );
  }, [data?.findManyApplications, objectMetadataItems]);
};
