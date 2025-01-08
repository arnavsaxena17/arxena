import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { getLabelIdentifierFieldMetadataItem } from '@/object-metadata/utils/getLabelIdentifierFieldMetadataItem';

export const getObjectMetadataIdentifierFields = ({
  objectMetadataItem,
}: {
  objectMetadataItem: ObjectMetadataItem;
}) => {
  const labelIdentifierFieldMetadataItem =
    getLabelIdentifierFieldMetadataItem(objectMetadataItem);

  console.log("getLabelIdentifierFieldMetadataItem", labelIdentifierFieldMetadataItem);
  const imageIdentifierFieldMetadataItem = objectMetadataItem.fields.find(
    (field) => field.id === objectMetadataItem.imageIdentifierFieldMetadataId,
  );

  return {
    labelIdentifierFieldMetadataItem,
    imageIdentifierFieldMetadataItem,
  };
};
