import { executeQuery } from 'src/engine/core-modules/workspace-modifications/object-apis/utils/graphqlClient';
import { CreateOneFieldMetadataItem, FieldInput } from 'twenty-shared';

export async function createFields(fieldsData: FieldInput[], apiToken: string) {
    console.log("Number of fields to be created", fieldsData.length);

    // First validate that all fields have required objectMetadataId
    const missingObjectIds = fieldsData.filter(item => !item?.field?.objectMetadataId);
    if (missingObjectIds.length > 0) {
        console.error('The following fields are missing objectMetadataId:', 
            missingObjectIds.map(item => item?.field?.name).join(', '));
        throw new Error('Some fields are missing objectMetadataId');
    }

    // Create a set of unique objectMetadataIds that we need
    const requiredObjectIds = new Set(
        fieldsData
            .filter((item): item is Required<FieldInput> => !!item?.field?.objectMetadataId)
            .map(item => item.field.objectMetadataId)
    );
    console.log('Required object IDs:', Array.from(requiredObjectIds));

    for (const item of fieldsData) {
        if (!item?.field) {
            console.error('Invalid field data:', item);
            continue;
        }

        console.log('Creating field:', item.field.name, 'for object:', item.field.objectMetadataId);
        
        const input = {
            field: {
                type: item.field.type,
                name: item.field.name,
                label: item.field.label,
                description: item.field.description,
                icon: item.field.icon,
                objectMetadataId: item.field.objectMetadataId,
                options: item.field.options
            }
        };
        const mutation = {
            query: CreateOneFieldMetadataItem,
            variables: { input }
        };

        try {
            console.log('Creating field with input:', JSON.stringify(input, null, 2));
            await executeQuery(mutation.query, mutation.variables, apiToken);
            console.log('Successfully created field:', item.field.name);
        } catch (error) {
            console.error('Error creating field with input:', JSON.stringify(input, null, 2));
            console.error('Error:', error);
            throw error; // Re-throw to handle at higher level
        }
    }
}