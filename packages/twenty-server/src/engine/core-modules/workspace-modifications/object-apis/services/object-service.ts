import { executeQuery } from 'src/engine/core-modules/workspace-modifications/object-apis/utils/graphqlClient';
import { CreateOneObjectInput, CreateOneObjectMetadataItem } from 'twenty-shared';

export async function createObjectMetadataItems(
  apiToken: string,
  objectCreationArr: CreateOneObjectInput[],
  origin: string,
): Promise<void> {
  if (!objectCreationArr || !Array.isArray(objectCreationArr)) {
    console.error('Invalid objectCreationArr:', objectCreationArr);
    return;
  }

  for (const item of objectCreationArr) {
    if (!item || !item.object) {
      console.error('Invalid object item:', item);
      continue;
    }

    const input = { object: item.object };

    try {
      await executeQuery(CreateOneObjectMetadataItem, { input }, apiToken, origin);
      console.log(`Created object: ${item.object.nameSingular || 'unnamed'}`);
    } catch (error) {
      console.error(`Error creating object ${item.object.nameSingular || 'unnamed'}:`, error);
      throw error;
    }
  }
}