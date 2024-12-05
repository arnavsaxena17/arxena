import { executeQuery } from '../utils/graphqlClient';
import { mutations } from '../mutations/mutations';
import { getRelationsData } from '../data/relationsData';
import { CreateOneRelationInput, RelationInput } from '../types/types';

export async function createRelations(fieldRelations:RelationInput[] , apiToken: string) {
    // console.log("objectsNameIdMap", objectsNameIdMap);
    for (const item of fieldRelations) {
        const input = {
            relation: {
                fromObjectMetadataId: item?.relation?.fromObjectMetadataId,  // Required!
                toObjectMetadataId: item?.relation?.toObjectMetadataId,      // Required!
                relationType: item?.relation?.relationType,
                fromName: item?.relation?.fromName,
                toName: item?.relation?.toName,
                fromDescription: item?.relation?.fromDescription,
                toDescription: item?.relation?.toDescription,
                fromLabel: item?.relation?.fromLabel,
                toLabel: item?.relation?.toLabel,
                fromIcon: item?.relation?.fromIcon,
                toIcon: item?.relation?.toIcon
            }
        };

        const mutation = {
            query: mutations.createRelation,
            variables: { input }
        };

        try {
            const responseObj = await executeQuery(mutation.query, mutation.variables, apiToken);
            console.log("Relations responseObj in obj:::", responseObj);
        } catch (error) {
            console.error('Error creating relation:', error);
        }
    }
}
