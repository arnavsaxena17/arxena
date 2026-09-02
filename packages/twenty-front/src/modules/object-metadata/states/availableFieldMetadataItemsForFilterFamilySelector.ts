import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { objectMetadataItemsWithFieldsSelector } from '@/object-metadata/states/objectMetadataItemsWithFieldsSelector';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { getFilterFilterableFieldMetadataItems } from '@/object-metadata/utils/getFilterFilterableFieldMetadataItems';
import { createAtomFamilySelector } from '@/ui/utilities/state/jotai/utils/createAtomFamilySelector';
import { isDefined } from 'twenty-shared/utils';

export const availableFieldMetadataItemsForFilterFamilySelector =
  createAtomFamilySelector<
    FieldMetadataItem[],
    { objectMetadataItemId: string }
  >({
    key: 'availableFieldMetadataItemsForFilterFamilySelector',
    get:
      ({ objectMetadataItemId }: { objectMetadataItemId: string }) =>
      ({ get }) => {
        // Keep workspace read so this selector invalidates with workspace
        // changes (feature flags / readable fields), even though JSON path
        // filters are always enabled for Arxena outreach analytics.
        get(currentWorkspaceState);

        const objectMetadataItems = get(objectMetadataItemsWithFieldsSelector);

        const objectMetadataItem = objectMetadataItems.find(
          (item) => item.id === objectMetadataItemId,
        );
        if (!isDefined(objectMetadataItem)) {
          return [];
        }

        const filterFilterableFieldMetadataItems =
          getFilterFilterableFieldMetadataItems({
            isJsonFilterEnabled: true,
          });

        return objectMetadataItem.readableFields.filter(
          filterFilterableFieldMetadataItems,
        );
      },
  });
