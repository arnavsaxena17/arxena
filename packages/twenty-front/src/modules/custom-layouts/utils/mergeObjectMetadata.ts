import { FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';

type ObjectMetadataNode = {
  __typename: string;
  node: {
    __typename: string;
    id: string;
    dataSourceId: string;
    nameSingular: string;
    namePlural: string;
    labelSingular: string;
    labelPlural: string;
    description: string;
    icon: string;
    isCustom: boolean;
    isRemote: boolean;
    isActive: boolean;
    isSystem: boolean;
    createdAt: string;
    updatedAt: string;
    labelIdentifierFieldMetadataId: string | null;
    imageIdentifierFieldMetadataId: string | null;
    fieldsList: FieldMetadataItem[];
  };
};

export const mergeObjectMetadata = (
  candidateMetadata: ObjectMetadataNode,
  jobMetadata: ObjectMetadataNode,
): ObjectMetadataItem => {
  // Extract base metadata from candidate
  const {
    id,
    nameSingular,
    namePlural,
    labelSingular,
    labelPlural,
    icon,
    isCustom,
    isRemote,
    isActive,
    isSystem,
    createdAt,
    updatedAt,
    labelIdentifierFieldMetadataId,
    imageIdentifierFieldMetadataId,
  } = candidateMetadata.node;

  // Create merged fields list
  const mergedFields: FieldMetadataItem[] = [
    // Add candidate fields
    ...candidateMetadata.node.fieldsList.map((field) => ({
      ...field,
      name: `candidate${field.name.charAt(0).toUpperCase() + field.name.slice(1)}`,
      label: `Candidate ${field.label}`,
    })),
    // Add job fields
    ...jobMetadata.node.fieldsList.map((field) => ({
      ...field,
      name: `job${field.name.charAt(0).toUpperCase() + field.name.slice(1)}`,
      label: `Job ${field.label}`,
    })),
  ];

  // Create merged metadata object
  const mergedMetadata: ObjectMetadataItem = {
    __typename: 'ObjectMetadataItem',
    id,
    nameSingular,
    namePlural,
    labelSingular,
    labelPlural,
    description: 'Combined view of Jobs and Candidates',
    icon: 'IconBriefcase',
    isCustom,
    isRemote,
    isActive,
    isSystem,
    createdAt,
    updatedAt,
    labelIdentifierFieldMetadataId: labelIdentifierFieldMetadataId ?? '',
    imageIdentifierFieldMetadataId: imageIdentifierFieldMetadataId ?? '',
    fields: mergedFields,
    indexMetadatas: [],
    isLabelSyncedWithName: false,
  };

  return mergedMetadata;
}; 