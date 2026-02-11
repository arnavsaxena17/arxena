import { mutationToCreateOneCandidateEnrichment } from 'twenty-shared';
import { arxAiFilters } from '../data/arxAiFilters';
import { executeGraphQLQuery } from '../utils/graphqlClient';

export async function createArxAiFilters(apiToken: string): Promise<void> {

    for (const aiFilter of arxAiFilters) {
        try {
            (aiFilter as unknown as Record<string, unknown>)['name'] = aiFilter.modelName;
            await executeGraphQLQuery(mutationToCreateOneCandidateEnrichment, {
                input: aiFilter
            }, apiToken);
            console.log(`Created arx AI filter: ${aiFilter.modelName}`);
        } catch (error) {
            console.error(`Error creating arx AI filter ${aiFilter.modelName}:`, error);
            throw error;
        }
    }
}
