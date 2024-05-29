import * as allDataObjects from 'src/engine/core-modules/recruitment-agent/services/data-model-objects';
import { calculateMaxTokens, getModelContextSize} from "@langchain/core/language_models/base";
import { get_encoding } from "tiktoken";

export const statusOptions = ["Contacted", "JD shared", "Meeting Scheduled", "Not Interested", "Not Fit"] as const


function getQuestionsToAsk(candidateProfile: allDataObjects.PersonNode, recruiterProfile: allDataObjects.recruiterProfileType, jobProfile: allDataObjects.jobProfileType){
    const screeningQuestionsMap = {
        "relocation": "Are you interested in relocation?",
        "company": "Are you interested in the given company?"
    }
    return screeningQuestionsMap

}

function getAvailableTimeSlots(){

}


function updateAnswerToQuestion(){
    

}



export async function getSystemPrompt(availableTimeSlots: string, candidateProfile: allDataObjects.PersonNode, recruiterProfile: allDataObjects.recruiterProfileType, jobProfile: allDataObjects.jobProfileType){
    const screeningQuestionsMap = await getQuestionsToAsk(candidateProfile, recruiterProfile, jobProfile);
    const SYSTEM_PROMPT = `
    You will drive the conversation with candidates like the recruiter. Your goal is to assess the candidates for interest and fitment.
    If found reasonably fit, your goal is to setup a meeting at a available time.
    You will start the chat with asking if they are interested and available for a call.
    They may either ask questions or show interest or provide a time slot. You will first ask them a few screening questions one by one before confirming a time.
    Your screening questions are :
    1. ${screeningQuestionsMap.relocation}
    2. ${screeningQuestionsMap.company}
    If the candidate, asks details about the role or the company, share the JD with him/ her by calling the function "shareJD".
    Even if the candidate doesn't ask about the role or the company, do share the JD with him/ her by calling the function "shareJD". 
    Apart from your starting sentence, have small chats and not long winded sentences.
    You will decide if the candidate is fit if the candidate answers the screening questions positively.
    If the candidate has shown interest and is fit, you will have to schedule a meeting with the candidate. You can call the function "scheduleMeeting" to schedule a meeting with the candidate.
    If the candidate has shown interest and is fit, you will update the candidate profile with the status "Meeting Scheduled". You can call the function "updateCandidateProfile" to update the candidate profile.
    If the candidate is not interested, you will update the candidate profile with the status "Not Interested". You can call the function "updateCandidateProfile" to update the candidate profile.
    If the candidate is interested but not fit, you will update the candidate profile with the status "Not Fit". You can call the function "updateCandidateProfile" to update the candidate profile.
    After each message to the candidate, you will call the function updateCandidateProfile to update the candidate profile. The update will comprise of one of the following updates - "Contacted", "JD shared", "Meeting Scheduled", "Not Interested", "Not Fit".
    Sometimes candidates will send forwards and irrelevant messages. You will have to ignore them. If the candidate unnecessarily replies and messages, you will reply with "boo". 
    You will not indicate any updates to the candidate.
    Available timeslots are: ${availableTimeSlots}
    Your first message when you receive the prompt "hi" is: Hey ${candidateProfile.name.firstName},
    I'm ${recruiterProfile.first_name}, ${recruiterProfile.job_title} at ${recruiterProfile.job_company_name}, ${recruiterProfile.company_description_oneliner}.
    I'm hiring for a ${jobProfile.name} role for ${jobProfile.company.descriptionOneliner} and got your application on my job posting. I believe this might be a good fit.
    Wanted to speak to you in regards your interests in our new role. Would you be available for a short call sometime today?`;
    
    return SYSTEM_PROMPT;
}


async function calCalculateTokenswithTiktoken(availableTimeSlots: string, candidateProfile: allDataObjects.PersonNode, recruiterProfile: allDataObjects.recruiterProfileType, jobProfile: allDataObjects.jobProfileType){
    const SYSTEM_PROMPT = await getSystemPrompt(availableTimeSlots, candidateProfile, recruiterProfile, jobProfile)
    const prompt = SYSTEM_PROMPT;
    const modelName = "gpt-3.5-turbo";
    calculateMaxTokens({ prompt, modelName }).then(maxTokens => { console.log("MaxTokens:",maxTokens); }).catch(error => { console.error(error); });
    const contextSize = getModelContextSize(modelName);
    console.log("ContextSize:", contextSize);
    const encoding = get_encoding("cl100k_base");
    const tokens = encoding.encode(SYSTEM_PROMPT);
    encoding.free();
    console.log("Tokens:", tokens.length);
}
