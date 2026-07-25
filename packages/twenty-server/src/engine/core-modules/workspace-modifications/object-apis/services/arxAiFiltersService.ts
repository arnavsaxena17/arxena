import { mutationToCreateOneCandidateEnrichment } from 'twenty-shared';
import { arxAiFilters } from '../data/arxAiFilters';
import { executeGraphQLQuery } from '../utils/graphqlClient';

export async function createArxAiFilters(apiToken: string): Promise<void> {

    for (const aiFilter of arxAiFilters) {
        try {
            const { fields, ...aiFilterWithoutFields } = aiFilter;
            await executeGraphQLQuery(mutationToCreateOneCandidateEnrichment, {
                input: {
                    ...aiFilterWithoutFields,
                    name: aiFilter.modelName,
                    filterFields: fields,
                },
            }, apiToken);
            console.log(`Created arx AI filter: ${aiFilter.modelName}`);
        } catch (error) {
            console.error(`Error creating arx AI filter ${aiFilter.modelName}:`, error);
            throw error;
        }
    }
}
