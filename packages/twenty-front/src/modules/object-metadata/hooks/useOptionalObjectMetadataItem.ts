import { useRecoilValue } from 'recoil';

import { objectMetadataItemFamilySelector } from '@/object-metadata/states/objectMetadataItemFamilySelector';
import { isWorkflowRelatedObjectMetadata } from '@/object-metadata/utils/isWorkflowRelatedObjectMetadata';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { isDefined } from 'twenty-shared';
import { FeatureFlagKey } from '~/generated-metadata/graphql';

import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { ObjectMetadataItemIdentifier } from '../types/ObjectMetadataItemIdentifier';

export type OptionalObjectMetadataItemResult = {
  objectMetadataItem: ObjectMetadataItem | undefined;
  isWorkflowAccessBlocked: boolean;
};

/**
 * Like useObjectMetadataItem but never throws: returns undefined when the object
 * is missing or when workflow objects are blocked. Use when hooks must run even
 * if metadata is not available (e.g. optional CRM objects like "candidate").
 */
export const useOptionalObjectMetadataItem = ({
  objectNameSingular,
}: ObjectMetadataItemIdentifier): OptionalObjectMetadataItemResult => {
  const objectMetadataItem = useRecoilValue(
    objectMetadataItemFamilySelector({
      objectName: objectNameSingular,
      objectNameType: 'singular',
    }),
  );

  const isWorkflowEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IsWorkflowEnabled,
  );

  const isWorkflowToBeFiltered =
    !isWorkflowEnabled && isWorkflowRelatedObjectMetadata(objectNameSingular);

  if (isWorkflowToBeFiltered) {
    return {
      objectMetadataItem: undefined,
      isWorkflowAccessBlocked: true,
    };
  }

  return {
    objectMetadataItem: isDefined(objectMetadataItem)
      ? objectMetadataItem
      : undefined,
    isWorkflowAccessBlocked: false,
  };
};
