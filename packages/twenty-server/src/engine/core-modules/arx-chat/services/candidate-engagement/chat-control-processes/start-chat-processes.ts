import { axiosRequest } from '../../../utils/arx-chat-agent-utils';
import { TimeManagement } from '../scheduling-agent';
import * as allGraphQLQueries from '../../../graphql-queries/graphql-queries-chatbot';

export class StartChatProcesses {
  private isWithinWorkingHours(): boolean {
    const currentTime = new Date();
    const hours = currentTime.getHours();
    return hours >= 9 && hours < 20; // 9 AM to 8 PM IST
  }

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

  async getRecentlyUpdatedCandidateIdsWithStatusConversationClosed(apiToken: string): Promise<string[]> {
    if (!this.isWithinWorkingHours()) {
      console.log('Outside working hours, skipping conversation closed checks');
      return [];
    }

    try {
      const timeWindow = TimeManagement.timeDifferentials.timeDifferentialinHoursForCheckingCandidateIdsWithStatusOfConversationClosed;
      const currentTime = new Date();
      const cutoffTime = new Date(currentTime.getTime() - (timeWindow * 60 * 60 * 1000));

      console.log('Time window for conversation closed check:');
      console.log('Current time:', currentTime.toISOString());
      console.log('Cutoff time:', cutoffTime.toISOString());
      console.log('Time window (hours):', timeWindow);

      const graphqlQueryObj = JSON.stringify({
        query: allGraphQLQueries.graphqlToFetchAllCandidateData,
        variables: {
          filter: {
            updatedAt: { 
              gte: cutoffTime.toISOString(), 
              lte: currentTime.toISOString() 
            },
            candConversationStatus: { 
              in: ['CONVERSATION_CLOSED_TO_BE_CONTACTED', 'CANDIDATE_IS_KEEN_TO_CHAT'] 
            },
            startChat: { eq: true },
            startVideoInterviewChat: { eq: false },
            startMeetingSchedulingChat: { eq: false },
          },
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      });

      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const candidates = response?.data?.data?.candidates?.edges || [];

      // Log candidate details for debugging
      candidates.forEach(edge => {
        console.log(`Candidate ID: ${edge.node.id}`);
        console.log(`Status: ${edge.node.candConversationStatus}`);
        console.log(`Updated At: ${edge.node.updatedAt}`);
        console.log('---');
      });

      // Extract unique candidate IDs
      const candidateIds = Array.from(new Set(
        candidates.map(edge => edge.node.id)
      ));

      console.log(`Found ${candidateIds.length} candidates with conversation closed status`);
      
      return candidateIds as string[];

    } catch (error) {
      console.error('Error fetching candidates with conversation closed status:', error);
      return [];
    }
}}
