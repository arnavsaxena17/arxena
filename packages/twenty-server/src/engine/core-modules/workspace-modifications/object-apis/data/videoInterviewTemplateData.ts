import { VideoInterviewTemplate } from "twenty-shared";

export function generateVideoInterviewTemplateData(videoInterviewModelIds: string[], projectIds: string[]): VideoInterviewTemplate[] {
    return Array.from({ length: 1 }, (_, i) => ({
        name: `Sample Interview ${i + 1}`,
        videoInterviewModelId: getRandomId(videoInterviewModelIds),
        projectId: getRandomId(projectIds)
    }));
}

function getRandomId(ids: string[]): string {
    const randomIndex = Math.floor(Math.random() * ids.length);
    return ids[randomIndex];
}