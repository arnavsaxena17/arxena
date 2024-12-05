import { executeQuery } from '../utils/graphqlClient';
import { mutations } from '../mutations/mutations';
import { CreateOneObjectInput } from '../types/types';

export async function createObjectMetadataItems(apiToken: string, objectCreationArr: CreateOneObjectInput[]) {
    for (const item of objectCreationArr) {
        const input = {
            object: item.object
        };

        const mutation = {
            query: mutations.createObject,
            variables: { input }
        };

        try {
            await executeQuery(mutation.query, mutation.variables, apiToken);
        } catch (error) {
            console.error('Error creating object:', error);
            return null;
        }
    }
}

