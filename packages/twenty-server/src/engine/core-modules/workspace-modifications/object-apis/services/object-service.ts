import { CreateOneObjectInput, CreateOneObjectMetadataItem } from 'twenty-shared';
import { executeQuery } from '../utils/graphqlClient';

export async function createObjectMetadataItems(apiToken: string, objectCreationArr: CreateOneObjectInput[]) {
    if (!objectCreationArr || !Array.isArray(objectCreationArr)) {
        console.error('Invalid objectCreationArr:', objectCreationArr);
        return;
    }

    for (const item of objectCreationArr) {
        if (!item || !item.object) {
            console.error('Invalid object item:', item);
            continue;
        }

        const input = {
            object: item.object
        };

        const mutation = {
            query: CreateOneObjectMetadataItem,
            variables: { input }
        };

        try {
            const response = await executeQuery(mutation.query, mutation.variables, apiToken);
            console.log(`Created object: ${item.object.nameSingular || 'unnamed'}`);
        } catch (error) {
            console.error(`Error creating object ${item.object.nameSingular || 'unnamed'}:`, error);
        }
    }
}
