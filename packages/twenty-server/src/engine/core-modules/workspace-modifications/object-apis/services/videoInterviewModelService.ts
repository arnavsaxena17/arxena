import { executeQuery, executeGraphQLQuery } from '../utils/graphqlClient';
import { mutations } from '../mutations/mutations';
import { generateVideoInterviewModelData } from '../data/videoInterviewModelData';
import { VideoInterviewModel } from '../types/types.js';

export async function createVideoInterviewModels(token:string): Promise<string[]> {
    const createVideoInterviewModels = generateVideoInterviewModelData();
    const createdIds: string[] = [];

    for (const model of createVideoInterviewModels) {
        try {
            const response = await executeGraphQLQuery(mutations.createVideoInterviewModel, { 
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

export async function getVideoInterviewModelIds(token): Promise<string[]> {
    const response = await executeGraphQLQuery(`
        query VideoInterviewModels {
            videoInterviewModels {
                edges {
                    node {
                        id
                    }
                }
            }
        }
    `, {}, token) as { data: { videoInterviewModels: { edges: { node: { id: string } }[] } } };

    return response.data.videoInterviewModels.edges.map((edge: any) => edge.node.id);
}