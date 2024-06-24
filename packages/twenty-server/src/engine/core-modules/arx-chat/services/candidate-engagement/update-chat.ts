
import * as allDataObjects from '../../services/data-model-objects'; 
import * as allGraphQLQueries from '../../services/candidate-engagement/graphql-queries-chatbot';
import { v4 } from 'uuid';
import {axiosRequest} from '../../utils/arx-chat-agent-utils';
import axios from 'axios';
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
    async getPersonDetailsByPhoneNumber(phoneNumber: string) {
        console.log("Trying to get person details by phone number:", phoneNumber)
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
            const graphqlQueryObj = JSON.stringify({
                query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber,
                variables: graphVariables
            })
            const response = await axiosRequest(graphqlQueryObj);
            console.log("This is the response from getCandidate Information FROM PHONENUMBER",  response.data.data)
            const personObj = response.data?.data?.people?.edges[0].node;
            console.log("Personobj:", personObj)
            return personObj
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
                const personWithActiveJob = response?.data?.data?.people?.edges?.find((person: { node: { candidates: { edges: any[]; }; }; }) => 
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
                    whatsappMessages: activeJobCandidateObj?.node?.whatsappMessages,
                    // *! TO CHECK LATER
                    emailMessages: {
                        edges: activeJobCandidateObj?.node?.emailMessages?.edges
                    }
                    // ############################
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


    async fetchQuestionsByJobId(jobId: string): Promise<{questionIdArray: {
        questionId: string;
        question: string;
    }[], questionArray: string[]}>{
        const data = JSON.stringify({
            query: allGraphQLQueries.graphqlQueryToFindManyQuestionsByJobId
            ,
            variables: {"filter":{"jobsId":{"in":[`${jobId}`]}},"orderBy":{"position":"DescNullsFirst"}}
          });
       
          const response = await axios.request({
            method: 'post',
              url: process.env.GRAPHQL_URL,
              headers: {
                  'authorization': 'Bearer ' + process.env.TWENTY_JWT_SECRET,
                  'content-type': 'application/json',
              },
              data: data
          })
          console.log(response?.data)
          
          const questionsArray: string[] = response?.data?.data?.questions?.edges.map((val: { node: { name: string; }; }) => val.node.name);
          console.log(questionsArray)

          const questionIdArray = response?.data?.data?.questions?.edges?.map((val: { node: { id: string; name: string; }; }) => { return {questionId: val.node.id, question: val.node.name}});
          return {questionArray: questionsArray,questionIdArray: questionIdArray}
    }


    async createAndUpdateWhatsappMessage( candidateProfileObj: allDataObjects.CandidateNode, userMessage:allDataObjects.candidateChatMessageType ) {
        console.log("This is the candidate profile object", JSON.stringify(candidateProfileObj));
        // console.log("This is the user message for updateWhtsappMessage in createAnd UpdateWhatsappMessage", userMessage);
        console.log("This is the user messageObj for updateWhtsappMessage", userMessage?.messageObj);
        console.log("This is the number of messages in  updateWhtsappMessage", userMessage?.messageObj.length);
        // console.log("This is the message being published ", userMessage?.messages[0]?.text);
        console.log("This is the message being published ", userMessage?.messages[0]?.content);
            // debugger
        // console.log("This is the user message phoneNumberTo", userMessage?.phoneNumberTo);
        const createNewWhatsappMessageUpdateVariables = {
            input: {
                "position": "first",
                "id": v4(),
                "candidateId": candidateProfileObj?.id,
                "message": userMessage?.messages[0]?.content || userMessage?.messages[0]?.text,
                "phoneFrom": userMessage?.phoneNumberFrom,
                "phoneTo": userMessage?.phoneNumberTo,
                "jobsId":  candidateProfileObj.jobs?.id,
                "recruiterId":  candidateProfileObj?.jobs?.recruiterId,
                "name": userMessage?.messageType,
                "messageObj":userMessage?.messageObj,
                "whatsappDeliveryStatus": userMessage.whatsappDeliveryStatus,
                "whatsappMessageId": userMessage?.whatsappMessageId
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
            console.log("This is the response from the axios request in createAndUpdateWhatsappMessage::", response.data);
            return response.data;    
        } catch (error) {
            console.log(error);
        }
    }

    async updateCandidateEngagementStatus(candidateProfileObj:allDataObjects.CandidateNode, whatappUpdateMessageObj:allDataObjects.candidateChatMessageType) {
        // debugger
        console.log("Updating candidate's status", candidateProfileObj, whatappUpdateMessageObj);
        // debugger
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

    async setCandidateEngagementStatusToFalse(candidateProfileObj:allDataObjects.CandidateNode){
        const updateCandidateObjectVariables = {
            idToUpdate: candidateProfileObj?.id,
            input: {
                engagementStatus: false
            },
        };
        console.log("This is the value of updatecandidateobject variables::0", updateCandidateObjectVariables)
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
    async updateCandidateAnswer(candidateProfileObj:allDataObjects.CandidateNode, AnswerMessageObj:allDataObjects.AnswerMessageObj) {
        console.log("Updating candidate's status", candidateProfileObj, JSON.stringify(AnswerMessageObj));
        const updateCandidateObjectVariables = {
            input: {
                ...AnswerMessageObj
            },
        };
        const graphqlQueryObj = JSON.stringify({
            query: allGraphQLQueries.graphqlQueryToCreateOneAnswer,
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
    async scheduleCandidateInterview(candidateProfileObj:allDataObjects.CandidateNode, scheduleInterviewObj:allDataObjects.candidateChatMessageType) {
        console.log("Updating candidate's status", candidateProfileObj, JSON.stringify(scheduleInterviewObj));
        const candidateEngagementStatus = scheduleInterviewObj.messageType !== 'botMessage';
        const updateCandidateObjectVariables = {
            idToUpdate: candidateProfileObj?.id,
            input: {
                scheduleInterviewObj: scheduleInterviewObj
            },
        };
        const graphqlQueryObj = JSON.stringify({
            query: {},
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
    
    async removeChatsByPhoneNumber(phoneNumberFrom:string){
        const personObj:allDataObjects.PersonNode = await this.getPersonDetailsByPhoneNumber(phoneNumberFrom)
        const personCandidateNode = personObj?.candidates?.edges[0]?.node;
        const messagesList = personCandidateNode?.whatsappMessages?.edges;
        console.log("Current Messages list:", messagesList);
        const messageIDs = messagesList?.map((message) => message?.node?.id);
        this.removeChatsByMessageIDs(messageIDs);
    }
    async removeChatsByMessageIDs(messageIDs:string[]){
        const graphQLVariables = {
            "filter": {
                "id": {
                "in": messageIDs
                }
            }
        }
        const graphqlQueryObj = JSON.stringify({
            query: allGraphQLQueries.graphqlQueryToRemoveMessages,
            variables:graphQLVariables
            });
        const response = await axiosRequest(graphqlQueryObj);
        console.log("REsponse status:", response.status)
        return response;
    }


    
}
