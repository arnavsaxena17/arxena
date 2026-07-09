import { objectMetadataItemsState } from '@/object-metadata/states/objectMetadataItemsState';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useFieldMetadataItemById = (fieldMetadataId?: string) => {
  const objectMetadataItems = useRecoilValue(objectMetadataItemsState);

  const fieldMetadataItem = isDefined(fieldMetadataId)
    ? objectMetadataItems
        .flatMap((objectMetadataItem) => objectMetadataItem.fields)
        .find((field) => field.id === fieldMetadataId)
    : undefined;

  if (isDefined(fieldMetadataId) && !isDefined(fieldMetadataItem)) {
    throw new Error(`Field metadata item not found for id ${fieldMetadataId}`);
  }

  return { fieldMetadataItem };
};
