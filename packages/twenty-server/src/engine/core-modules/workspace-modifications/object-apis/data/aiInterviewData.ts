import { AIInterview } from '../types/types.js';

export function generateAIInterviewData(aiModelIds: string[], jobIds: string[]): AIInterview[] {
    return Array.from({ length: 10 }, (_, i) => ({
        name: `interview ${i + 1}`,
        aIModelId: getRandomId(aiModelIds),
        jobId: getRandomId(jobIds)
    }));
}

function getRandomId(ids: string[]): string {
    const randomIndex = Math.floor(Math.random() * ids.length);
    return ids[randomIndex];
}