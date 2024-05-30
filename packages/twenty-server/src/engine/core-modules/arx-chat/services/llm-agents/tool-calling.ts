import * as allDataObjects from "../data-model-objects";

const recruiterProfile =  allDataObjects.recruiterProfile
// const candidateProfileObjAllData =  candidateProfile
const jobProfile =  allDataObjects.jobProfile
const availableTimeSlots = "12PM-3PM, 4PM -6PM on the 24th and 25th January 2024."

export class ToolsForAgents{
    getQuestionsToAsk(){
        const questions = [
            "What is your current & expected CTC?",
            "Who do you report to and which functions report to you?",
            "Are you okay to relocate to {location}?"
          ];            
        const location = "Surat";
        const formattedQuestions = questions.map((question, index) => 
            `${index + 1}. ${question.replace("{location}", location)}`
          ).join("\n");

        return formattedQuestions
    }

    async getSystemPrompt(candidateProfile){
        const formattedQuestions = this.getQuestionsToAsk();
        const SYSTEM_PROMPT = `
        You will drive the conversation with candidates like the recruiter. Your goal is to assess the candidates for interest and fitment.
        If found reasonably fit, your goal is to setup a meeting at a available time.
        You will start the chat with asking if they are interested and available for a call.
        They may either ask questions or show interest or provide a time slot. You will first ask them a few screening questions one by one before confirming a time.
        Your screening questions are :
        ${formattedQuestions}
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
        Your first message when you receive the prompt "hi" is: Hey ${candidateProfile.name},
        I'm ${recruiterProfile.first_name}, ${recruiterProfile.job_title} at ${recruiterProfile.job_company_name}, ${recruiterProfile.company_description_oneliner}.
        I'm hiring for a ${jobProfile.name} role for ${jobProfile.company.descriptionOneliner} and got your application on my job posting. I believe this might be a good fit.
        Wanted to speak to you in regards your interests in our new role. Would you be available for a short call sometime today?`;
        
        return SYSTEM_PROMPT;
    }

    getAvailableFunctions(){
        return {
            share_jd: this.shareJD,
            update_candidate_profile: this.updateCandidateProfile,
            update_answer: this.updateAnswer,
            schedule_meeting: this.scheduleMeeting
        }
    }

    shareJD(inputs:any,  candidateProfileDataNodeObj:any){
      try{
        console.log("Function Called: shareJD")
        console.log("Function Called:  candidateProfileDataNodeObj:any",  candidateProfileDataNodeObj)
      }
      catch{
        debugger;
      }
      return "Shared the JD with the candidate and updated the database."
    }
    
    updateCandidateProfile(inputs:any, candidateProfileDataNodeObj:any){
      try{
        console.log("Function Called:  candidateProfileDataNodeObj:any",  candidateProfileDataNodeObj)
        return "Updated the candidate profile."
      }
      catch (error){
        console.log("Error in updateCandidateProfile:", error)
        debugger;
      }

    }
    
    updateAnswer(inputs:any,  candidateProfileDataNodeObj:any){
      // console.log("Received these inputs in Function Called:", inputs)
      try{
        console.log("Function Called:  candidateProfileDataNodeObj:any",  candidateProfileDataNodeObj)
        console.log("Function Called: updateAnswer")
      }
      catch{
        debugger;
      }
      
      return "Updated the candidate updateAnswer."
    }
    
    scheduleMeeting(inputs:any, candidateProfileDataNodeObj:any){
      // console.log("Received these inputs in Function Called:", inputs)
      console.log("Function Called:  candidateProfileDataNodeObj:any",  candidateProfileDataNodeObj)
      console.log("Function Called: scheduleMeeting")
      return "scheduleMeeting the candidate meeting."
    }
  
  
  async getTools(){
    const tools = [
      {
      "type": "function",
      "function": {
          "name": "share_jd",
          "description": "Share the candidate JD",
      }
      },
      {
      "type": "function",
      "function": {
          "name": "schedule_meeting",
          "description": "Schedule a meeting with the candidate",
      }
      },
      {
      "type": "function",
      "function": {
          "name": "update_candidate_profile",
          "description": "Update the candidate profile",
      }
      },
      {
      "type": "function",
      "function": {
          "name": "update_answer",
          "description": "Update the candidate's answer",
      }
      }
    ];
    return tools
  }
}