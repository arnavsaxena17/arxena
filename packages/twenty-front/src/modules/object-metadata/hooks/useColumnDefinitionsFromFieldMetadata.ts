import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { FieldMetadata } from '@/object-record/record-field/types/FieldMetadata';
import { ColumnDefinition } from '@/object-record/record-table/types/ColumnDefinition';
import { filterAvailableTableColumns } from '@/object-record/utils/filterAvailableTableColumns';

import { availableFieldMetadataItemsForFilterFamilySelector } from '@/object-metadata/states/availableFieldMetadataItemsForFilterFamilySelector';
import { useRecoilValue } from 'recoil';
import { formatFieldMetadataItemAsColumnDefinition } from '../utils/formatFieldMetadataItemAsColumnDefinition';
import { formatFieldMetadataItemsAsSortDefinitions } from '../utils/formatFieldMetadataItemsAsSortDefinitions';

export const useColumnDefinitionsFromFieldMetadata = (
  objectMetadataItem: ObjectMetadataItem,
) => {
  // const activeFieldMetadataItems = objectMetadataItem.fields.filter(
  //   ({ isActive, isSystem }) => isActive && !isSystem,
  // );

  const activeFieldMetadataItems = objectMetadataItem.fields.filter(
    ({ isActive, isSystem }) => {
      // For merged view, we want to include all fields
      if (window.location.href.includes('merged')) {
        return isActive;
      }
      // Default behavior for non-merged views
      return isActive && !isSystem;
    },
  );

  const filterableFieldMetadataItems = useRecoilValue(
    availableFieldMetadataItemsForFilterFamilySelector({
      objectMetadataItemId: objectMetadataItem.id,
    }),
  );
  console.log('filterableFieldMetadataItems::', filterableFieldMetadataItems);

  const sortDefinitions = formatFieldMetadataItemsAsSortDefinitions({
    fields: activeFieldMetadataItems,
  });
  console.log('activeFieldMetadataItems:', activeFieldMetadataItems);

  const columnDefinitions: ColumnDefinition<FieldMetadata>[] =
    activeFieldMetadataItems
      .map((field, index) =>
        formatFieldMetadataItemAsColumnDefinition({
          position: index,
          field,
          objectMetadataItem,
        }),
      )
      .filter(filterAvailableTableColumns)
      .map((column) => {
        const existsInFilterDefinitions = filterableFieldMetadataItems.some(
          (fieldMetadataItem) =>
            fieldMetadataItem.id === column.fieldMetadataId,
        );
        const existsInSortDefinitions = sortDefinitions.some(
          (sort) => sort.fieldMetadataId === column.fieldMetadataId,
        );
        return {
          ...column,
          isFilterable: existsInFilterDefinitions,
          isSortable: existsInSortDefinitions,
        };
      });
  console.log(
    'these are the column defintiions that we will use',
    columnDefinitions,
  );
  return {
    columnDefinitions,
    sortDefinitions,
  };
};
