import { Enrichment } from "../types/types";


export const arxEnrichments: Enrichment[] = [
    {
        modelName: "DistanceFromJob",
        prompt: "For the given location below, return the distance in kilometeres between the location and the Surat, Gujarat, India. Return only the distance in kilometers. No explanation is needed.",
        fields: [
            {
                name: "Distance_From_Job",
                type: "text",
                description: "This is the distance of the location from Surat, Gujarat, India in kilometers",
                required: true,
                id: 1733655403505
            }
        ],
        selectedMetadataFields: ["currentLocation"],
        selectedModel: "gpt4omini"
    },
    {
        modelName: "JobTitleClasssification",
        prompt: "Classify the given job title into one of the following function categories - sales, marketing, finance, legal and levels - entry, mid, senior, executive.",
        fields: [
            {
                name: "Function",
                type: "text",
                description: "This is the function within which the job title is classified",
                required: true,
                id: 1733654764250
            },
            {
                name: "Level",
                type: "text",
                description: "This is the level within which the job title is classified",
                required: true,
                id: 1733655310939
            }
        ],
        selectedMetadataFields: ["resumeheadline", "jobTitle"],
        selectedModel: "gpt4omini"
    }
];