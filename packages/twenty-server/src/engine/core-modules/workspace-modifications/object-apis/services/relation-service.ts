import { executeQuery } from 'src/engine/core-modules/workspace-modifications/object-apis/utils/graphqlClient';
import { CreateOneRelationMetadataItem, RelationInput } from 'twenty-shared';

export async function createRelations(
  fieldRelations: RelationInput[],
  apiToken: string,
  origin: string,
  maxRetries: number = 3,
): Promise<void> {
  for (const item of fieldRelations) {
    const input = {
      relationMetadata: {
        fromObjectMetadataId: item?.relationMetadata?.fromObjectMetadataId,
        toObjectMetadataId: item?.relationMetadata?.toObjectMetadataId,
        relationType: item?.relationMetadata?.relationType,
        fromName: item?.relationMetadata?.fromName,
        toName: item?.relationMetadata?.toName,
        fromDescription: item?.relationMetadata?.fromDescription,
        toDescription: item?.relationMetadata?.toDescription,
        fromLabel: item?.relationMetadata?.fromLabel,
        toLabel: item?.relationMetadata?.toLabel,
        fromIcon: item?.relationMetadata?.fromIcon,
        toIcon: item?.relationMetadata?.toIcon,
      },
    };

    try {
      await executeQuery(CreateOneRelationMetadataItem, { input }, apiToken, origin, maxRetries);
      console.log('Relation created, variables:', input);
    } catch (error) {
      console.error('Error creating relation:', error);
      throw error;
    }
  }
}