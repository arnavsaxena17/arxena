import { atomFamily } from 'recoil';

// Default metadata for the table
const defaultMetadata = {
  id: 'person-id',
  nameSingular: 'person',
  namePlural: 'people',
  labelSingular: 'Person',
  labelPlural: 'People',
  description: 'Person records',
  icon: 'IconUser',
  isCustom: false,
  isRemote: false,
  isActive: true,
  isSystem: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  labelIdentifierFieldMetadataId: 'name-field-id',
  imageIdentifierFieldMetadataId: null,
  isLabelSyncedWithName: true,
  fields: [],
  indexMetadatas: []
};

// Table metadata state for each instance of the table
export const tableMetadataState = atomFamily({
  key: 'tableMetadataState',
  default: defaultMetadata,
}); 