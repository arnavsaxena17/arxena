import { CreateOneRelationMetadataItem, RelationInput } from 'twenty-shared';
import { executeQuery } from '../utils/graphqlClient';

export async function createRelations(fieldRelations:RelationInput[] , apiToken: string) {
    // console.log("objectsNameIdMap", objectsNameIdMap);
    for (const item of fieldRelations) {
        const input = {
            relationMetadata: {
                fromObjectMetadataId: item?.relationMetadata?.fromObjectMetadataId,  // Required!
                toObjectMetadataId: item?.relationMetadata?.toObjectMetadataId,      // Required!
                relationType: item?.relationMetadata?.relationType,
                fromName: item?.relationMetadata?.fromName,
                toName: item?.relationMetadata?.toName,
                fromDescription: item?.relationMetadata?.fromDescription,
                toDescription: item?.relationMetadata?.toDescription,
                fromLabel: item?.relationMetadata?.fromLabel,
                toLabel: item?.relationMetadata?.toLabel,
                fromIcon: item?.relationMetadata?.fromIcon,
                toIcon: item?.relationMetadata?.toIcon
            }
        };

        const mutation = {
            query: CreateOneRelationMetadataItem,
            variables: { input }
        };

        try {
            const responseObj = await executeQuery(mutation.query, mutation.variables, apiToken);
            console.log("Relations responseObj in obj:::", responseObj);
            console.log("Relations variables in obj:::", mutation.variables);
        } catch (error) {
            console.error('Error creating relation:', error);
        }
    }
}
