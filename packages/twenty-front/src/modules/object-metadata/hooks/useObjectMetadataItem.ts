import { useRecoilValue } from 'recoil';

import { ObjectMetadataItemNotFoundError } from '@/object-metadata/errors/ObjectMetadataNotFoundError';
import { useOptionalObjectMetadataItem } from '@/object-metadata/hooks/useOptionalObjectMetadataItem';
import { objectMetadataItemsState } from '@/object-metadata/states/objectMetadataItemsState';
import { isDefined } from 'twenty-shared';

import { ObjectMetadataItemIdentifier } from '../types/ObjectMetadataItemIdentifier';

export const useObjectMetadataItem = ({
  objectNameSingular,
}: ObjectMetadataItemIdentifier) => {
  const { objectMetadataItem, isWorkflowAccessBlocked } =
    useOptionalObjectMetadataItem({
      objectNameSingular,
    });

  const objectMetadataItems = useRecoilValue(objectMetadataItemsState);

  if (isWorkflowAccessBlocked) {
    throw new Error(
      'Workflow is not enabled. If you want to use it, please enable it in the lab.',
    );
  }

  if (!isDefined(objectMetadataItem)) {
    throw new ObjectMetadataItemNotFoundError(
      objectNameSingular,
      objectMetadataItems,
    );
  }

  return {
    objectMetadataItem,
  };
};
