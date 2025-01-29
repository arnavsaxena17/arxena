import { axiosRequest } from "../../../utils/arx-chat-agent-utils";
import { TimeManagement } from "../scheduling-agent";
import * as allGraphQLQueries from '../../../graphql-queries/graphql-queries-chatbot';



export class StartChatProcesses{


      async getRecentCandidateIdsToMakeUpdatesonChats(apiToken: string): Promise<{ candidateIds: string[], jobIds: string[] }> {
          try {
            const fiveMinutesAgo = new Date(Date.now() - TimeManagement.timeDifferentials.timeDifferentialinMinutesForCheckingCandidateIdsToMakeUpdatesOnChatsForNextChatControls * 60 * 1000).toISOString();
            console.log('Fetching recent candidates with messages created after:', fiveMinutesAgo);
            const humanReadableTime = new Date(fiveMinutesAgo).toLocaleString();
            console.log('Fetching recent candidates with messages created after:', humanReadableTime);
            const graphqlQueryObj = JSON.stringify({
              query: allGraphQLQueries.graphQlToFetchWhatsappMessages,
              variables: { filter: { createdAt: { gte: fiveMinutesAgo } }, orderBy: [ { position: 'AscNullsFirst' } ] },
            });
      
            const data = await axiosRequest(graphqlQueryObj, apiToken);
            // Extract unique candidate IDs
            console.log("Number of whatsappmessages  minutes ago", data?.data?.data.whatsappMessages?.edges?.length);
            if (data?.data?.data?.whatsappMessages?.edges?.length > 0) {
              console.log('This is the number of messagesgetRecent mesages', data?.data?.data.whatsappMessages?.edges?.length);
      
              const filteredMessages = data?.data?.data.whatsappMessages?.edges.filter((edge: { node: { candidate: { startChat: boolean, startMeetingSchedulingChat: boolean, startVideoInterviewChat: boolean } } }) => !edge.node.candidate.startMeetingSchedulingChat && !edge.node.candidate.startVideoInterviewChat);
              const candidateIds: string[] = Array.from( new Set( filteredMessages.map((edge: { node: { candidateId: any; }; }) => edge?.node?.candidateId) ) ) as unknown as string[];
              console.log("This is the candidateIds who have messaged recently", candidateIds, "and are not in video interview stages or meeting scheduling stages");
                const jobIds: string[] = Array.from(new Set(filteredMessages.map((edge: { node: { jobsId: any; }; }) => edge?.node?.jobsId) ) ) as unknown as string[];
                console.log("This is the jobIds who have messaged recently", jobIds, "and are not in video interview stages or meeting scheduling stages");
                return { candidateIds, jobIds };
            } else {
              console.log('No recent candidates found');
              return { candidateIds: [], jobIds: [] };
            }
          } catch (error) {
            console.log('Error fetching recent WhatsApp messages:', error);
            return { candidateIds: [], jobIds: [] };
          }
        }

    async getRecentlyUpdatedCandidateIdsWithStatusConversationClosed(apiToken: string): Promise<string[]> {
      try {
        console.log("Goign to get recent candidate ids with status conversations")
        console.log("Date.now()::", new Date(Date.now()).toISOString());
        const sixHoursAgo = new Date(Date.now() - TimeManagement.timeDifferentials.timeDifferentialinHoursForCheckingCandidateIdsWithStatusOfConversationClosed * 60 * 60 * 1000).toISOString();
        console.log("Date.now() time differential ago that will be checked::", sixHoursAgo);
        const graphqlQueryObj = JSON.stringify({
          query: allGraphQLQueries.graphqlToFetchAllCandidateData,
          variables: { filter: { updatedAt: { lte: sixHoursAgo }, candConversationStatus: { in: ['CONVERSATION_CLOSED_TO_BE_CONTACTED','CANDIDATE_IS_KEEN_TO_CHAT'] }, startChat:{"eq":true}, startVideoInterviewChat:{"eq":false}, startMeetingSchedulingChat:{"eq":false} }, orderBy: [ { position: 'AscNullsFirst' } ] } });
          // console.log("This is the graphqlQueryObj", graphqlQueryObj);
        const data = await axiosRequest(graphqlQueryObj, apiToken);
        console.log("data of :getRecentlyUpdatedCandidateIdsWithStatusConversationClosed:::", data?.data?.data.candidates);

        const graphQltoGetConversationStatusOfAllClosedCandidates = JSON.stringify({
          query: allGraphQLQueries.graphqlToFetchAllCandidateData,
          variables: { filter: { candConversationStatus: { in: ['CONVERSATION_CLOSED_TO_BE_CONTACTED','CANDIDATE_IS_KEEN_TO_CHAT'] }, startChat:{"eq":true}, startVideoInterviewChat:{"eq":false}, startMeetingSchedulingChat:{"eq":false} }, orderBy: [ { position: 'AscNullsFirst' } ] } });
          const conversationStatusesOfAllClosedCandidates = await axiosRequest(graphQltoGetConversationStatusOfAllClosedCandidates, apiToken);

        // Log the last updatedAt for the candidates who match the criteria
        const lastUpdatedAt = conversationStatusesOfAllClosedCandidates?.data?.data.candidates.edges.forEach(edge => {
          console.log(`Candidate ID: ${edge.node.id}, Last Updated At: ${edge.node.updatedAt}`);
        });
        console.log("This is the lastUpdatedAt", lastUpdatedAt);

        // Extract unique candidate IDs
        if (data?.data?.data.candidates.edges.length > 0) {
          console.log('This is the number of people who messaged recently in getRecentC andidateIds', data?.data?.data.candidates.edges.length);
          const candidateIds: string[] = Array.from( new Set( data?.data?.data.candidates.edges.map(edge => edge?.node?.id) ) ) as unknown as string[];
  
          console.log("This is the candidateIds who have messaged recently", candidateIds, "and are in teh CONVERSATION_CLOSED_TO_BE_CONTACTED','CANDIDATE_IS_KEEN_TO_CHAT stages and for start chat stage");
  
          const filteredCandidateIds = candidateIds.filter(candidateId => {
            const candidate = data?.data?.data?.candidates?.edges.find(edge => edge?.node?.id === candidateId);
            if (candidate) {
              const updatedAt = candidate.node.updatedAt;
              console.log("This is updated at :", candidate.node.updatedAt);
              console.log("This is sixHoursAgo at :", sixHoursAgo);
              return new Date(updatedAt) < new Date(sixHoursAgo);
            }
            return false;
          });
          console.log("Thesea re the candidates who wre filtered Candidates Ids:", filteredCandidateIds);
  
          return filteredCandidateIds;
        } else {
          console.log('No recent candidates found which were updated in the last {} hours', sixHoursAgo);
          return [];
        }
      } catch (error) {
        console.log('Error fetching recent WhatsApp messages:', error);
        return [];
      }
    }

    
}