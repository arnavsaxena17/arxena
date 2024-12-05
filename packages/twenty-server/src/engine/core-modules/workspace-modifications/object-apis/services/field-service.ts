import { executeQuery } from '../utils/graphqlClient';
import { mutations } from '../mutations/mutations';
import { FieldCreationInput, FieldInput } from '../types/types';
export async function createFields(fieldsData:FieldInput[], apiToken: string) {
    for (const item of fieldsData ) {
        const input = {
            field: {
                type: item?.field?.type,
                name: item?.field?.name,
                label: item?.field?.label,
                description: item?.field?.description,
                icon: item?.field?.icon,
                objectMetadataId: item?.field?.objectMetadataId,
                options: item?.field?.options
            }
        };
        const mutation = {
            query: mutations.createField,
            variables: { input }
        };
        try {
            console.log('Creating field with input:', JSON.stringify(input, null, 2));
            await executeQuery(mutation.query, mutation.variables, apiToken);
        } catch (error) {
            console.error('Error creating field with input:', JSON.stringify(input, null, 2));
            console.error('Error:', error);
        }
    }
}
