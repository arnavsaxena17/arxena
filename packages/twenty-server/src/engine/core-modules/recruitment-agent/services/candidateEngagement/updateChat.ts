
import axios from 'axios';
import error from 'next/error';
import { from } from 'rxjs';
import { chatMessageType, candidateInfoType, emptyCandidateProfileObj, candidateProfileType,  recruiterProfile, candidateChatMessageType } from 'src/engine/core-modules/recruitment-agent/services/data-model-objects';
import { graphqlQueryToCreateOneNewWhatsappMessage, graphqlQueryToFindPeopleByPhoneNumber, graphqlQueryToUpdateCandidateStatus } from 'src/engine/core-modules/recruitment-agent/services/graphql-queries/graphql-queries-chatbot';
import { v4 } from 'uuid';
import CandidateEngagement from './checkCandidateEngagement';



export class UpdateChat {


    
    async getCandidateInformation(userMessage: chatMessageType) {
        // Get the candidate information from the user message
        console.log("This is the userMessage Content", userMessage.messages[0].content);
        console.log("This is the candidate userMessage", userMessage);
        console.log("This is the phoneNumberFrom", userMessage.phoneNumberFrom);
        console.log("This is the phoneNumberTo", userMessage.phoneNumberTo);
        console.log("This is the messageType", userMessage.messageType);
        
        const graphVariables = {
          "filter": {
          "phone": {
                "ilike": "%"+userMessage.phoneNumberFrom+"%"
                }
              },
                "orderBy": {
                "position": "AscNullsFirst"
            }
        };
        try {
            console.log("going to get candidate information")
            console.log("going to get process.env.TWENTY_JWT_SECRET",process.env.TWENTY_JWT_SECRET)
            console.log("going to get process.env.GRAPHQL_URL", process.env.GRAPHQL_URL)
            const response = await axios.request({
                method: 'post',
                url: process.env.GRAPHQL_URL,
                headers: {
                    'authorization': 'Bearer ' + process.env.TWENTY_JWT_SECRET,
                    'content-type': 'application/json',
                },
                data: JSON.stringify({
                    query: graphqlQueryToFindPeopleByPhoneNumber,
                    variables: graphVariables
                })
            });
    
            console.log("This is the response from getCandidateInformation", JSON.stringify(response.data))
            const candidateData = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
            console.log("This is the candidate data::", JSON.stringify(candidateData))
            const activeJobCandidate = candidateData.find((edge: any) => edge?.node?.jobs?.isActive);
            console.log("This is the number of candidates", candidateData.length)
    
            if (activeJobCandidate) {
                console.log("Active candidate found.:", activeJobCandidate);
                const candidateId = activeJobCandidate?.node?.id;
                const jobsId = activeJobCandidate?.node?.jobs?.id;
                const recruiterId = activeJobCandidate?.node?.jobs?.recruiterId;
                console.log("Candidate ID:", candidateId);
                console.log("Jobs ID:", jobsId);
                console.log("Responsible Workspace Member ID:", recruiterId);
                const candidateProfileObj: candidateProfileType = {
                    first_name: response?.data?.data?.people?.edges[0]?.node?.name?.firstName,
                    id: candidateId,
                    jobs: {
                        name: activeJobCandidate?.node?.jobs?.name,
                        id: jobsId,
                        recruiterId: recruiterId,
                        company: {
                            name: activeJobCandidate?.node?.jobs?.companies?.name,
                            companyId: activeJobCandidate?.node?.jobs?.companies?.id,
                            descriptionOneliner: activeJobCandidate?.node?.jobs?.companies?.descriptionOneliner
                          },
                        jobLocation: activeJobCandidate?.node?.jobs?.jobLocation,
                    },
                    status: activeJobCandidate?.node?.engagementStatus,
                    phoneNumber: response?.data?.data?.people?.edges[0]?.node?.phone,
                    email: response?.data?.data?.people?.edges[0]?.node?.email,
                    input: userMessage?.messages[0]?.content,
                    jobsId: jobsId,
                    recruiterId: recruiterId
                    
                }
                console.log("This is the candidate profile object", JSON.stringify(candidateProfileObj));
                return candidateProfileObj;
            } else {
                console.log("No active candidate found.");
                return emptyCandidateProfileObj;
            }
    
        } catch (error) {
            console.log("Getting an error and returning empty candidate profile objeect:", error)
            return emptyCandidateProfileObj;
        }
    }
    
    async createAndUpdateWhatsappMessage( candidateProfileObj: candidateProfileType, userMessage: chatMessageType) {
        console.log("This is the candidate profile object", JSON.stringify(candidateProfileObj));
        console.log("This is the user message phoneNumberFrom", userMessage?.phoneNumberFrom);
        console.log("This is the user message phoneNumberTo", userMessage?.phoneNumberTo);
        const createNewWhatsappMessageUpdateVariables = {
            input: {
                "position": "first",
                "id": v4(),
                "candidateId": candidateProfileObj?.id,
                "message": userMessage?.messages[0]?.content,
                "phoneFrom": userMessage?.phoneNumberFrom,
                "phoneTo": userMessage?.phoneNumberTo,
                "jobsId": candidateProfileObj?.jobs?.id,
                "recruiterId": candidateProfileObj?.jobs.recruiterId,
                "name": userMessage.messageType
            }
        };
        console.log("Going to create and update whatspp message in whatsapp table database, ",createNewWhatsappMessageUpdateVariables)
        console.log("These are the graphvsariables:", JSON.stringify(createNewWhatsappMessageUpdateVariables));
        const data = JSON.stringify({
            query: graphqlQueryToCreateOneNewWhatsappMessage,
            variables: createNewWhatsappMessageUpdateVariables
        });
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: process.env.GRAPHQL_URL,
            headers: {
                'authorization': 'Bearer ' + process.env.TWENTY_JWT_SECRET,
                'content-type': 'application/json',
              },
            data : data
        };
        console.log("This is the user message", userMessage);
        console.log("These are graph config", config);
        try {
            const response = await axios.request(config);
            console.log("This is the response from the axios request::", JSON.stringify(response.data));
            return response.data;    
        } catch (error) {
            console.log(error);
        }
    }
    
    
    async updateCandidateStatus(candidateProfileObj: candidateProfileType, whatappUpdateMessageObj: chatMessageType) {
        console.log("going to update candiadtes status", candidateProfileObj, JSON.stringify(whatappUpdateMessageObj))
        let candidateEngagementStatus = false;
        if (whatappUpdateMessageObj.messageType == 'botMessage'){
            candidateEngagementStatus = false
        }
        else{
            candidateEngagementStatus = true
        }
        const UpdateCandidateObjectVariables = {
            "idToUpdate":candidateProfileObj?.id,
            "input": {
              "engagementStatus": candidateEngagementStatus
            },
          }
          const data = JSON.stringify({
            query: graphqlQueryToUpdateCandidateStatus,
            variables: UpdateCandidateObjectVariables
        });
        console.log("These are the graphquery to update candidate statusw:", JSON.stringify(data));
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: process.env.GRAPHQL_URL,
            headers: { 
                'authorization': 'Bearer ' + process.env.TWENTY_JWT_SECRET,
                'content-type': 'application/json', 
              },
            data : data
        };
        console.log("This is the user message", whatappUpdateMessageObj);
        console.log("These are graph config", config);
        try {
            const response = await axios.request(config);
            console.log(JSON.stringify("response from axios update request to update candidates status",response.data));
            return response.data;
        } catch (error) {
            console.log(error);
        }
    }
    
    async  updateWhatsappMessageAndCandidateStatusInTable(whatappUpdateMessageObj: candidateChatMessageType) {
        let candidateProfileObj: candidateProfileType;
        console.log("This is the candidate information from getCandidate Information before solved", JSON.stringify(whatappUpdateMessageObj));
        if (whatappUpdateMessageObj.messageType != "botMessage") {
            console.log("Getting candidate profile object as messagetype is :", whatappUpdateMessageObj.messageType )
            candidateProfileObj = await this.getCandidateInformation(whatappUpdateMessageObj);
        }
        else{
            candidateProfileObj = whatappUpdateMessageObj.candidateProfile;
        }
        console.log("This is the candidate information from getCandidate Information after solved", JSON.stringify(candidateProfileObj));
        if (candidateProfileObj.first_name == '') {
            return;
        }
        else{
            console.log("Candidate information retrieved successfully")
        }
        const whatsappMessage = await this.createAndUpdateWhatsappMessage(candidateProfileObj, whatappUpdateMessageObj);
        if (!whatsappMessage) {
            return;
        }
        else{ 
            console.log("Whatsapp message created successfully")
        }
        const updateCandidateStatusObj = await this.updateCandidateStatus(candidateProfileObj, whatappUpdateMessageObj);
        if (!updateCandidateStatusObj) {
            return;
        }
        else{
            console.log("Candidate engagement status updated successfully")
        }
        
        return {"status":"success", "message":"Candidate engagement status updated successfully"};
    }
}
