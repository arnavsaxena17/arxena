import { axiosRequest } from '../../../utils/arx-chat-agent-utils';
import { TimeManagement } from '../scheduling-agent';
import * as allGraphQLQueries from '../../../graphql-queries/graphql-queries-chatbot';

export class StartChatProcesses {

  async getRecentCandidateIdsToMakeUpdatesonChats(apiToken: string, startTime: Date, endTime: Date): Promise<{ candidateIds: string[]; jobIds: string[] }> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - TimeManagement.timeDifferentials.timeDifferentialinMinutesForCheckingCandidateIdsToMakeUpdatesOnChatsForNextChatControls * 60 * 1000).toISOString();
      const humanReadableTime = new Date(fiveMinutesAgo).toLocaleString();
      console.log('Fetching recent candidates with messages created after:', humanReadableTime);
      const graphqlQueryObj = JSON.stringify({
        query: allGraphQLQueries.graphQlToFetchWhatsappMessages,
        variables: { filter: { createdAt: { gte: startTime.toISOString(), lte: endTime.toISOString() } }, orderBy: [{ position: 'AscNullsFirst' }] },
      });

      const data = await axiosRequest(graphqlQueryObj, apiToken);
      // Extract unique candidate IDs
      console.log('Number of whatsappmessages  minutes ago', data?.data?.data.whatsappMessages?.edges?.length);
      if (data?.data?.data?.whatsappMessages?.edges?.length > 0) {
        console.log('This is the number of messagesgetRecent mesages', data?.data?.data.whatsappMessages?.edges?.length);

        const filteredMessages = data?.data?.data.whatsappMessages?.edges.filter(
          (edge: { node: { candidate: { startChat: boolean; startMeetingSchedulingChat: boolean; startVideoInterviewChat: boolean } } }) => !edge.node.candidate.startMeetingSchedulingChat && !edge.node.candidate.startVideoInterviewChat,
        );
        const candidateIds: string[] = Array.from(new Set(filteredMessages.map((edge: { node: { candidateId: any } }) => edge?.node?.candidateId))) as unknown as string[];
        console.log('This is the candidateIds who have messaged recently', candidateIds, 'and are not in video interview stages or meeting scheduling stages');
        const jobIds: string[] = Array.from(new Set(filteredMessages.map((edge: { node: { jobsId: any } }) => edge?.node?.jobsId))) as unknown as string[];
        console.log('This is the jobIds who have messaged recently', jobIds, 'and are not in video interview stages or meeting scheduling stages');
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




}
