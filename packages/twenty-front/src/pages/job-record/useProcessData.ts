export const useProcessData = (record: any): any => {
  console.log('record', record);
  const columnsForDisplayingRecords = record?.questions?.map((question: any) => {
    return {
      fieldMetadataId: '82c12527-f554-4970-ad5d-ce8b6968f057',
      label: question?.name,
      type: 'TEXT',
      metadata: {
        fieldName: question?.name,
        placeHolder: question?.name,
        relationObjectMetadataNameSingular: '',
        relationObjectMetadataNamePlural: '',
        objectMetadataNameSingular: 'job',
        targetFieldMetadataName: '',
        options: null,
      },
      iconName: 'Icon123',
      defaultValue: "''",
      position: 13,
      size: 100,
      isLabelIdentifier: false,
      isVisible: true,
      isFilterable: true,
      isSortable: true,
    };
  });

  const rowsToDisplayingRecords = record?.answers?.map((answer: any) => {
    return {};
  });

  console.log('columnsForDisplayingRecords', columnsForDisplayingRecords);

  return { columnsForDisplayingRecords };
};
