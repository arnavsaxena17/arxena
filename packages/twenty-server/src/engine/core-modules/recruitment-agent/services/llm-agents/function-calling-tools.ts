    import { DynamicTool, DynamicStructuredTool  } from "@langchain/core/tools";
    import { z } from "zod";
    import { statusOptions } from 'src/engine/core-modules/recruitment-agent/services/llm-agents/langchain-system-prompt';
    import { PersonNode } from "src/engine/core-modules/recruitment-agent/services/data-model-objects";
    import { shareJDtoCandidate, updateCandidateStatus } from "src/engine/core-modules/recruitment-agent/services/llm-agents/tool-calls-processing";

    // console.log("statusOptions:",statusOptions);



    export class CandidateTools{
        person: any;

        constructor(person: PersonNode){
            this.person = person;
            console.log("CandidateTools constructor");
        }
        async shareJDUpdateDatabase  (input:string) {
            console.log("This is the input for shareJDUpdateDatabase", input);
            console.log("Sharing the JD and and updating the database as needed");
            // candidateProfile.status = "test";
            const result  = {status: "JD shared and database updated"};
            console.log("This is the person in the tool call shared JD ::", this.person)
            shareJDtoCandidate(this.person)
            return JSON.stringify(result);
        }

        async updateCandidateProfileFromSources ({ status }: { status: (typeof statusOptions)[number] }) {
            console.log("This is the updateCandidateProfileFromSources status", status);
            console.log("This is the person in the tool call updateCandidateProfile ::", this.person)
            // Rest of the code...
            updateCandidateStatus(this.person, status)
            return "Updated the candidate profile with the status."
        }

    }





    export function createCandidateTools(person: PersonNode) {
        const candidateTools = new CandidateTools(person);
    
        const updateCandidateProfileTool = new DynamicStructuredTool({
            name: "updateCandidateProfile",
            description: "Update the status of the candidate.",
            schema: z.object({
                status: z.string(z.enum(statusOptions).describe(`Status must be one of '${statusOptions.join("', '")}'`))
            }),
            func: candidateTools.updateCandidateProfileFromSources.bind(candidateTools)
        });
    
        const shareJDTool = new DynamicTool({
            name: "shareJD",
            description: "Share the candidate JD and update the database.",
            func: candidateTools.shareJDUpdateDatabase.bind(candidateTools)
        });
    
        return [updateCandidateProfileTool, shareJDTool];

    }
    




    // export const updateCandidateProfileFunctions  = new DynamicStructuredTool({
    //     name: "updateCandidateProfile",
    //     description: "This updates the status of the candidate with the status desired",
    //     schema: z.object({
    //         status: z.string(z.enum(statusOptions).describe(`status must be one of '${statusOptions.join("', '")}'`)).describe("One of the statuses to update the candidate with."),
    //     }),
    //     func: updateCandidateProfileFromSources
    // });

    // export const shareJD  = new DynamicTool({ name: "shareJD", description: "Share the candidate JD and update the database.", func: shareJDUpdateDatabase });