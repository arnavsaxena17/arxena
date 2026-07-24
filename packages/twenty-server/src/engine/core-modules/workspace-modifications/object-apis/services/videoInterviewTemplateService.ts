import { CreateOneVideoInterviewTemplate } from 'twenty-shared';
import { generateVideoInterviewTemplateData } from '../data/videoInterviewTemplateData';
import { executeGraphQLQuery } from '../utils/graphqlClient';

export async function createVideoInterviewTemplates(videoInterviewModelIds: string[], jobIds: string[], apiToken:string): Promise<void> {
    const videoInterviewTemplates = generateVideoInterviewTemplateData(videoInterviewModelIds, jobIds);

    for (const interview of videoInterviewTemplates) {
        try {
            await executeGraphQLQuery(CreateOneVideoInterviewTemplate, { 
                input: interview 
            },apiToken);
            console.log(`Created Video Interview: ${interview.name}`);
        } catch (error) {
            console.error(`Error creating Video Interview ${interview.name}:`, error);
            throw error;
        }
    }
}

export async function getJobIds(apiToken: string): Promise<string[]> {
    const response = await executeGraphQLQuery(`
        query Jobs {
            jobs {
                edges {
                    node {
                        id
                        isActive
                    }
                }
            }
        }
    `, {}, apiToken) as { data: { jobs: { edges: { node: { id: string } }[] } } };

    return response.data.jobs.edges.map((edge: any) => edge.node.id);
}