import { CreateOneVideoInterviewModel } from 'twenty-shared';
import { generateVideoInterviewModelData } from '../data/videoInterviewModelData';
import { executeGraphQLQuery } from '../utils/graphqlClient';

export async function createVideoInterviewModels(token:string): Promise<string[]> {
    const createVideoInterviewModels = generateVideoInterviewModelData();
    const createdIds: string[] = [];

    for (const model of createVideoInterviewModels) {
        try {
            const response = await executeGraphQLQuery(CreateOneVideoInterviewModel, { 
                input: model 
            }, token) as { data: { createVideoInterviewModel: { id: string } } };
            createdIds.push(response.data.createVideoInterviewModel.id);
            console.log(`Created Video Interview Model: ${model.name}`);
        } catch (error) {
            console.error(`Error creating Video Interview Model ${model.name}:`, error);
            throw error;
        }
    }

    return createdIds;
}
