import { objectMetadataItemsState } from '@/object-metadata/states/objectMetadataItemsState';
import { isActiveFieldMetadataItem } from '@/object-metadata/utils/isActiveFieldMetadataItem';
import { RecordFieldsComponentInstanceContext } from '@/object-record/record-field/states/context/RecordFieldsComponentInstanceContext';
import { currentRecordFieldsComponentState } from '@/object-record/record-field/states/currentRecordFieldsComponentState';
import { createComponentSelectorV2 } from '@/ui/utilities/state/component-state/utils/createComponentSelectorV2';
import { findById } from 'twenty-shared/utils';
import { sortByProperty } from '~/utils/array/sortByProperty';

export const visibleRecordFieldsComponentSelector = createComponentSelectorV2({
  key: 'visibleRecordFieldsComponentSelector',
  componentInstanceContext: RecordFieldsComponentInstanceContext,
  get:
    ({ instanceId }) =>
    ({ get }) => {
      const currentRecordFields = get(
        currentRecordFieldsComponentState.atomFamily({
          instanceId,
        }),
      );

      const objectMetadataItems = get(objectMetadataItemsState);

      const filteredVisibleAndReadableRecordFields = currentRecordFields.filter(
        (recordFieldToFilter) => {
          if (!recordFieldToFilter.isVisible) {
            return false;
          }

          const objectMetadataItem = objectMetadataItems.find(
            (objectMetadataItem) =>
              objectMetadataItem.fields.some(
                (fieldMetadataItem) =>
                  fieldMetadataItem.id ===
                  recordFieldToFilter.fieldMetadataItemId,
              ),
          );

          if (!objectMetadataItem) {
            return false;
          }

          const fieldMetadataItem = objectMetadataItem.fields.find(
            (fieldMetadataItem) =>
              fieldMetadataItem.id === recordFieldToFilter.fieldMetadataItemId,
          );

          if (!fieldMetadataItem) {
            return false;
          }

          const isLabelIdentifier =
            fieldMetadataItem.id ===
            objectMetadataItem.labelIdentifierFieldMetadataId;

          const isActive =
            isLabelIdentifier ||
            isActiveFieldMetadataItem({
              objectNameSingular: objectMetadataItem.nameSingular,
              fieldMetadata: fieldMetadataItem,
            });

          const isReadable = objectMetadataItem.readableFields.some(
            findById(fieldMetadataItem.id),
          );

          return isReadable && isActive;
        },
      );

      return [...filteredVisibleAndReadableRecordFields].sort(
        sortByProperty('position'),
      );
    },
});
