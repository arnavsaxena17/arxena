import { VideoInterviewTemplate } from '../types/types.js';

export function generateVideoInterviewTemplateData(videoInterviewModelIds: string[], jobIds: string[]): VideoInterviewTemplate[] {
    return Array.from({ length: 1 }, (_, i) => ({
        name: `Sample Interview ${i + 1}`,
        videoInterviewModelId: getRandomId(videoInterviewModelIds),
        jobId: getRandomId(jobIds)
    }));
}

function getRandomId(ids: string[]): string {
    const randomIndex = Math.floor(Math.random() * ids.length);
    return ids[randomIndex];
}