
import *  as allDataObjects from 'src/engine/core-modules/recruitment-agent/services/data-model-objects'; 
import * as allGraphQLQueries from 'src/engine/core-modules/recruitment-agent/services/candidate-engagement/graphql-queries-chatbot';
import { v4 } from 'uuid';
import {axiosRequest} from 'src/engine/core-modules/recruitment-agent/utils/recruitmentAgentUtils';
export class FetchAndUpdateCandidatesChatsWhatsapps {
    async fetchCandidatesToEngage(){
        let graphqlQueryObj = JSON.stringify({
          query: allGraphQLQueries.graphqlQueryToFindEngagedCandidates,
          variables: {}
        });
        try {
            const response = await axiosRequest(graphqlQueryObj);
            return response;
        } catch (error) {
            console.log(error);
        }
    }


    async getCandidateDetailsByPhoneNumber(phoneNumber: string) {
        const graphVariables = {
            "filter": {
            "phone": {
                  "ilike": "%"+phoneNumber+"%"
              }},
                  "orderBy": {
                  "position": "AscNullsFirst"
              }
          };
          try {
              console.log("going to get candidate information")
              // console.log("going to get process.env.TWENTY_JWT_SECRET",process.env.TWENTY_JWT_SECRET)
              // console.log("going to get process.env.GRAPHQL_URL", process.env.GRAPHQL_URL)
              const graphqlQueryObj = JSON.stringify({
                  query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber,
                  variables: graphVariables
              })
              const response = await axiosRequest(graphqlQueryObj);
              console.log("This is the response from getCandidate Information FROM PHONENUMBER",  response.data.data)
              const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
              return candidateDataObjs
            }
            catch (error) {
                console.log("Getting an error and returning empty candidate profile objeect:", error)
                return allDataObjects.emptyCandidateProfileObj;
            }

    }

    async getCandidateInformation(userMessage: allDataObjects.chatMessageType) {
        // Get the candidate information from the user message
        // console.log("This is the userMessage Content", userMessage.messages[0].content);
        // console.log("This is the candidate userMessage", userMessage);
        console.log("This is the phoneNumberFrom", userMessage.phoneNumberFrom);
        // console.log("This is the phoneNumberTo", userMessage.phoneNumberTo);
        // console.log("This is the messageType", userMessage.messageType);
        const graphVariables = {
          "filter": {
          "phone": {
                "ilike": "%"+userMessage.phoneNumberFrom+"%"
            }},
                "orderBy": {
                "position": "AscNullsFirst"
            }
        };
        try {
            console.log("going to get candidate information")
            // console.log("going to get process.env.TWENTY_JWT_SECRET",process.env.TWENTY_JWT_SECRET)
            // console.log("going to get process.env.GRAPHQL_URL", process.env.GRAPHQL_URL)
            const graphqlQueryObj = JSON.stringify({
                query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber,
                variables: graphVariables
            })
            const response = await axiosRequest(graphqlQueryObj);
            console.log("This is the response from getCandidate Information",  response.data.data)
            const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
            console.log("This is the candidate data::", candidateDataObjs);

            const activeJobCandidateObj = candidateDataObjs?.find((edge: any) => edge?.node?.jobs?.isActive);
            console.log("This is the number of candidates", candidateDataObjs?.length);
            console.log("This is the activeJobCandidateObj", activeJobCandidateObj);
            if (activeJobCandidateObj) {
                const personWithActiveJob = response?.data?.data?.people?.edges?.find(person => 
                    person?.node?.candidates?.edges?.some(candidate => candidate?.node?.jobs?.isActive)
                );
                const candidateProfileObj: allDataObjects.CandidateNode = {
                    name: personWithActiveJob?.node?.name?.firstName,
                    id: activeJobCandidateObj?.node?.id,
                    jobs: {
                        name: activeJobCandidateObj?.node?.jobs?.name,
                        id: activeJobCandidateObj?.node?.jobs?.id,
                        recruiterId: activeJobCandidateObj?.node?.jobs?.recruiterId,
                        companies: {
                            name: activeJobCandidateObj?.node?.jobs?.companies?.name,
                            companyId: activeJobCandidateObj?.node?.jobs?.companies?.id,
                            descriptionOneliner: activeJobCandidateObj?.node?.jobs?.companies?.descriptionOneliner
                        },
                        jobLocation: activeJobCandidateObj?.node?.jobs?.jobLocation,
                        whatsappMessages: activeJobCandidateObj?.node?.jobs?.whatsappMessages
                    },
                    engagementStatus: activeJobCandidateObj?.node?.engagementStatus,
                    phoneNumber: personWithActiveJob?.node?.phone,
                    email: personWithActiveJob?.node?.email,
                    input: userMessage?.messages[0]?.content,
                    startChat: activeJobCandidateObj?.node?.startChat,
                    whatsappMessages: activeJobCandidateObj?.node?.whatsappMessages
                };
                return candidateProfileObj;
            } else {
                console.log("No active candidate found.");
                return allDataObjects.emptyCandidateProfileObj;
            }
        } catch (error) {
            console.log("Getting an error and returning empty candidate profile objeect:", error)
            return allDataObjects.emptyCandidateProfileObj;
        }
    }
    
    async createAndUpdateWhatsappMessage( candidateProfileObj: allDataObjects.CandidateNode, userMessage:allDataObjects.candidateChatMessageType ) {
        console.log("This is the candidate profile object", JSON.stringify(candidateProfileObj));
        console.log("This is the user message for updateWhtsappMessage in createAndUpdateWhatsappMessage", userMessage);
        console.log("This is the user messageObj for updateWhtsappMessage", userMessage?.messageObj);
        console.log("This is the number of messages in  updateWhtsappMessage", userMessage?.messageObj.length);
        console.log("This is the message being published ", userMessage?.messages[0]?.text);
        console.log("This is the message being published ", userMessage?.messages[0]?.content);
        // console.log("This is the user message phoneNumberTo", userMessage?.phoneNumberTo);
        const createNewWhatsappMessageUpdateVariables = {
            input: {
                "position": "first",
                "id": v4(),
                "candidateId": candidateProfileObj?.id,
                "message": userMessage?.messages[0]?.content || userMessage?.messages[0]?.text,
                "phoneFrom": userMessage?.phoneNumberFrom,
                "phoneTo": userMessage?.phoneNumberTo,
                "jobsId": candidateProfileObj[0]?.node.jobs?.id || candidateProfileObj.jobs?.id,
                "recruiterId": candidateProfileObj[0]?.node?.jobs?.recruiterId || candidateProfileObj?.jobs?.recruiterId,
                "name": userMessage?.messageType,
                "messageObj":userMessage?.messageObj
            }
        };
        console.log("These are the graphvsariables:", JSON.stringify(createNewWhatsappMessageUpdateVariables));
        const graphqlQueryObj = JSON.stringify({
            query: allGraphQLQueries.graphqlQueryToCreateOneNewWhatsappMessage,
            variables: createNewWhatsappMessageUpdateVariables
        });
        // console.log("This is the user message", userMessage);
        // console.log("These are graph config data", graphqlQueryObj);
        try {
            const response = await axiosRequest(graphqlQueryObj);
            console.log("This is the response from the axios request::", response.data);
            return response.data;    
        } catch (error) {
            console.log(error);
        }
    }
    
    async updateCandidateEngagementStatus(candidateProfileObj, whatappUpdateMessageObj) {
        console.log("Updating candidate's status", candidateProfileObj, JSON.stringify(whatappUpdateMessageObj));
    
        const candidateEngagementStatus = whatappUpdateMessageObj.messageType !== 'botMessage';
        const updateCandidateObjectVariables = {
            idToUpdate: candidateProfileObj?.id,
            input: {
                engagementStatus: candidateEngagementStatus
            },
        };
        const graphqlQueryObj = JSON.stringify({
            query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus,
            variables: updateCandidateObjectVariables
        });
        // console.log("GraphQL query to update candidate status:", graphqlQueryObj);
        try {
            const response = await axiosRequest(graphqlQueryObj);
            console.log("Response from axios update request:", response.data);
            return response.data;
        } catch (error) {
            console.log(error);
        }
    }


    async updateCandidateStatus(candidateProfileObj, whatappUpdateMessageObj) {
        console.log("Updating candidate's status", candidateProfileObj, JSON.stringify(whatappUpdateMessageObj));
    
        const candidateEngagementStatus = whatappUpdateMessageObj.messageType !== 'botMessage';
        const updateCandidateObjectVariables = {
            idToUpdate: candidateProfileObj?.id,
            input: {
                engagementStatus: candidateEngagementStatus
            },
        };
        const graphqlQueryObj = JSON.stringify({
            query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus,
            variables: updateCandidateObjectVariables
        });
        // console.log("GraphQL query to update candidate status:", graphqlQueryObj);
        try {
            const response = await axiosRequest(graphqlQueryObj);
            console.log("Response from axios update request:", response.data);
            return response.data;
        } catch (error) {
            console.log(error);
        }
    }
}
