import { availableFieldMetadataItemsForFilterFamilySelector } from '@/object-metadata/states/availableFieldMetadataItemsForFilterFamilySelector';
import { FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { useRecoilCallback } from 'recoil';

export const useGetDefaultFieldMetadataItemForFilter = () => {
  const getDefaultFieldMetadataItemForFilter = useRecoilCallback(
    ({ snapshot }) =>
      (objectMetadataItem: ObjectMetadataItem) => {
        const availableFieldMetadataItemsForFilter = snapshot
          .getLoadable(
            availableFieldMetadataItemsForFilterFamilySelector({
              objectMetadataItemId: objectMetadataItem.id,
            }),
          )
          .getValue();

        const fieldMetadataItemForLabelIdentifier =
          availableFieldMetadataItemsForFilter.find(
            (fieldMetadataItem) =>
              fieldMetadataItem.id ===
              objectMetadataItem.labelIdentifierFieldMetadataId,
          );

        const firstFieldMetadataItem = availableFieldMetadataItemsForFilter?.[0] as
          | FieldMetadataItem
          | undefined;

        const defaultFieldMetadataItemForFilter =
          fieldMetadataItemForLabelIdentifier ?? firstFieldMetadataItem;

        return { defaultFieldMetadataItemForFilter };
      },
    [],
  );

  return {
    getDefaultFieldMetadataItemForFilter,
  };
};
