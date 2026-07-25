import { CreateOneVideoInterviewTemplate } from 'twenty-shared';
import { generateVideoInterviewTemplateData } from '../data/videoInterviewTemplateData';
import { executeGraphQLQuery } from '../utils/graphqlClient';

export async function createVideoInterviewTemplates(videoInterviewModelIds: string[], projectIds: string[], apiToken:string): Promise<void> {
    const videoInterviewTemplates = generateVideoInterviewTemplateData(videoInterviewModelIds, projectIds);

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

export async function getProjectIds(apiToken: string): Promise<string[]> {
    const response = await executeGraphQLQuery(`
        query Projects {
            projects {
                edges {
                    node {
                        id
                        isActive
                    }
                }
            }
        }
    `, {}, apiToken) as { data: { projects: { edges: { node: { id: string } }[] } } };

    return response.data.projects.edges.map((edge: any) => edge.node.id);
}