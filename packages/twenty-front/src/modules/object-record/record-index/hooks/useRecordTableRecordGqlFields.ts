import { useRecoilValue } from 'recoil';

import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { getObjectMetadataIdentifierFields } from '@/object-metadata/utils/getObjectMetadataIdentifierFields';
import { useRecordTableStates } from '@/object-record/record-table/hooks/internal/useRecordTableStates';
import { isDefined } from '~/utils/isDefined';
import { useColumnDefinitionsFromFieldMetadata } from '@/object-metadata/hooks/useColumnDefinitionsFromFieldMetadata';

export const useRecordTableRecordGqlFields = ({
  objectMetadataItem,
}: {
  objectMetadataItem: ObjectMetadataItem;
}) => {
  const { visibleTableColumnsSelector } = useRecordTableStates();
  const { columnDefinitions } =
  useColumnDefinitionsFromFieldMetadata(objectMetadataItem);
  console.log("These are the column definitions inside recordGqlFields:", columnDefinitions);
// Add columnDefinitions to recordGqlFields and deduplicate

  const { imageIdentifierFieldMetadataItem, labelIdentifierFieldMetadataItem } =
    getObjectMetadataIdentifierFields({ objectMetadataItem });


    console.log("labelIdentifierFieldMetadataItem:", labelIdentifierFieldMetadataItem);
  const visibleTableColumns = useRecoilValue(visibleTableColumnsSelector());
  console.log("visibleTableColumns:::", visibleTableColumns);

  const identifierQueryFields: Record<string, boolean> = {};

  if (isDefined(labelIdentifierFieldMetadataItem)) {
    identifierQueryFields[labelIdentifierFieldMetadataItem.name] = true;
  }

  if (isDefined(imageIdentifierFieldMetadataItem)) {
    identifierQueryFields[imageIdentifierFieldMetadataItem.name] = true;
  }

  const recordGqlFields: Record<string, any> = {
    id: true,
    ...Object.fromEntries(
      visibleTableColumns.map((column) => [column.metadata.fieldName, true]),
    ),
    ...identifierQueryFields,
    position: true,
  };

  // console.log("recordGqlFields1", recordGqlFields);


  // columnDefinitions.forEach((column) => {
  //   const key = column.metadata.fieldName;
  //   if (!recordGqlFields[key]) {
  //     recordGqlFields[key] = true;
  //   }
  //   });

  
  console.log("identifierQueryFields", identifierQueryFields);
  console.log("recordGqlFields2", recordGqlFields);

  return recordGqlFields;
};
