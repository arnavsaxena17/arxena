import { mutationToCreateOneCandidateEnrichment } from 'twenty-shared';
import { arxEnrichments } from '../data/arxEnrichments';
import { executeGraphQLQuery } from '../utils/graphqlClient';

export async function createArxEnrichments(apiToken:string): Promise<void> {

    for (const enrichment of arxEnrichments) {
        try {
            enrichment['name'] = enrichment['modelName'];
            await executeGraphQLQuery(mutationToCreateOneCandidateEnrichment, { 
                input: enrichment 
            }, apiToken);
            console.log(`Created arxe enrichment: ${enrichment.modelName}`);
        } catch (error) {
            console.error(`Error creating arx enrichment ${enrichment.modelName}:`, error);
            throw error;
        }
    }
}

