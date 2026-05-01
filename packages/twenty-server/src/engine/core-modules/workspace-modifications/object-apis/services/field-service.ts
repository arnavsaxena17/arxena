import { executeQuery } from 'src/engine/core-modules/workspace-modifications/object-apis/utils/graphqlClient';
import { CreateOneFieldMetadataItem, FieldInput } from 'twenty-shared';

const isDuplicateFieldNameError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('duplicating another field') ||
      (message.includes('name "') && message.includes('not available'))
    ) {
      return true;
    }
  }

  const serializedError = JSON.stringify(error).toLowerCase();

  return (
    serializedError.includes('duplicating another field') ||
    (serializedError.includes('name "') &&
      serializedError.includes('not available'))
  );
};

export async function createFields(
  fieldsData: FieldInput[],
  apiToken: string,
  origin: string,
  maxRetries: number = 3,
): Promise<void> {
  console.log('Number of fields to be created', fieldsData.length);
  for (const item of fieldsData) {
    if (!item?.field?.objectMetadataId) {
      console.log('Field objectMetadataId is not defined for item:', item?.field?.name);
      continue;
    }
    console.log(
      'Field objectMetadataId is defined for item:',
      item?.field?.name,
      'will go and setup the field',
    );
    const input = {
      field: {
        type: item?.field?.type,
        name: item?.field?.name,
        label: item?.field?.label,
        description: item?.field?.description,
        icon: item?.field?.icon,
        objectMetadataId: item?.field?.objectMetadataId,
        options: item?.field?.options,
        defaultValue: item?.field?.defaultValue,
      },
    };
    try {
      console.log('Creating field with input:', JSON.stringify(input, null, 2));
      await executeQuery(CreateOneFieldMetadataItem, { input }, apiToken, origin, maxRetries);
    } catch (error) {
      if (isDuplicateFieldNameError(error)) {
        console.warn(
          '[createFields] Skipping duplicate field metadata seed',
          {
            name: item?.field?.name,
            objectMetadataId: item?.field?.objectMetadataId,
          },
        );
        continue;
      }
      console.log('Error creating field with input:', JSON.stringify(input, null, 2));
      console.log('Error:', error);
      throw error;
    }
  }
}