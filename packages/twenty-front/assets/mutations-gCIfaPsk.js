import{v as e}from"./index-BzerUb1B.js";const a=e`
  mutation CreateOneObjectMetadataItem($input: CreateOneObjectInput!) {
    createOneObject(input: $input) {
      id
      dataSourceId
      nameSingular
      namePlural
      labelSingular
      labelPlural
      description
      icon
      isCustom
      isActive
      createdAt
      updatedAt
      labelIdentifierFieldMetadataId
      imageIdentifierFieldMetadataId
    }
  }
`,d=e`
  mutation CreateOneFieldMetadataItem($input: CreateOneFieldMetadataInput!) {
    createOneField(input: $input) {
      id
      type
      name
      label
      description
      icon
      isCustom
      isActive
      isNullable
      createdAt
      updatedAt
      settings
      defaultValue
      options
    }
  }
`,i=e`
  mutation CreateOneRelationMetadataItem(
    $input: CreateOneRelationMetadataInput!
  ) {
    createOneRelationMetadata(input: $input) {
      id
      relationType
      fromObjectMetadataId
      toObjectMetadataId
      fromFieldMetadataId
      toFieldMetadataId
      createdAt
      updatedAt
    }
  }
`,n=e`
  mutation UpdateOneFieldMetadataItem(
    $idToUpdate: UUID!
    $updatePayload: UpdateFieldInput!
  ) {
    updateOneField(input: { id: $idToUpdate, update: $updatePayload }) {
      id
      type
      name
      label
      description
      icon
      isCustom
      isActive
      isNullable
      createdAt
      updatedAt
      settings
      isLabelSyncedWithName
    }
  }
`,l=e`
  mutation UpdateOneObjectMetadataItem(
    $idToUpdate: UUID!
    $updatePayload: UpdateObjectPayload!
  ) {
    updateOneObject(input: { id: $idToUpdate, update: $updatePayload }) {
      id
      dataSourceId
      nameSingular
      namePlural
      labelSingular
      labelPlural
      description
      icon
      isCustom
      isActive
      createdAt
      updatedAt
      labelIdentifierFieldMetadataId
      imageIdentifierFieldMetadataId
    }
  }
`,o=e`
  mutation DeleteOneObjectMetadataItem($idToDelete: UUID!) {
    deleteOneObject(input: { id: $idToDelete }) {
      id
      dataSourceId
      nameSingular
      namePlural
      labelSingular
      labelPlural
      description
      icon
      isCustom
      isActive
      createdAt
      updatedAt
      labelIdentifierFieldMetadataId
      imageIdentifierFieldMetadataId
    }
  }
`,u=e`
  mutation DeleteOneFieldMetadataItem($idToDelete: UUID!) {
    deleteOneField(input: { id: $idToDelete }) {
      id
      type
      name
      label
      description
      icon
      isCustom
      isActive
      isNullable
      createdAt
      updatedAt
      settings
    }
  }
`,p=e`
  mutation DeleteOneRelationMetadataItem($idToDelete: UUID!) {
    deleteOneRelation(input: { id: $idToDelete }) {
      id
    }
  }
`;export{a as C,o as D,l as U,i as a,p as b,d as c,u as d,n as e};
