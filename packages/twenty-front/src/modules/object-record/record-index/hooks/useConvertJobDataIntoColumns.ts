export const useConvertJobDataIntoColumns = ({}) => {
  return {
    fieldMetadataId: '82c12527-f554-4970-ad5d-ce8b6968f057',
    label: 'People',
    type: 'RELATION',
    metadata: {
      fieldName: 'people',
      placeHolder: 'People',
      relationType: 'TO_ONE_OBJECT',
      relationFieldMetadataId: '71cd913f-13be-4791-9eee-86a3020efa9b',
      relationObjectMetadataNameSingular: 'clientContact',
      relationObjectMetadataNamePlural: 'clientContacts',
      objectMetadataNameSingular: 'job',
      targetFieldMetadataName: 'clientContacts',
      options: null,
    },
    iconName: 'Icon123',
    defaultValue: null,
    editButtonIcon: {
      propTypes: {},
    },
    position: 4,
    size: 100,
    isLabelIdentifier: false,
    isVisible: true,
    isFilterable: true,
    isSortable: false,
  };
};
