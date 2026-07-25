import { Injectable } from '@nestjs/common';
import {
  CandidateEdge,
  graphqlToFetchAllCandidateDataWithFieldValues,
  PageInfo,
} from 'twenty-shared';
import { CandidateService } from '../../candidate-sourcing/services/candidate.service';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { ArxChatEndpoint } from '../controllers/arx-chat-agent.controller';

interface Candidate {
  id: string;
  personId: string;
  phoneNumber?: string;
}

interface Message {
  content: string;
}

@Injectable()
export class TestArxChat {
  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly candidateService: CandidateService,
    private readonly arxChatEndpoint: ArxChatEndpoint,
  ) {}

  async testChatFlow(apiToken: string): Promise<object> {
    try {
      // Step 1: Get all jobs and take the first one
      const responseFromGetAllJobs = await this.staticGraphQLService.executeGraphQL(
        'query { projects { edges { node { id name } } } }',
        { limit: 30, orderBy: [{ position: 'AscNullsFirst' }] },
        apiToken,
      );
      
      const projects = responseFromGetAllJobs?.data?.data?.projects?.edges;
      if (!jobs || jobs.length === 0) {
        throw new Error('No jobs found');
      }
      
      const firstJob = jobs[0].node;
      console.log('Selected job:', firstJob.name);

      // Step 2: Get candidates for this project(same logic as CandidateSourcingController.getCandidatesByProjectId)
      const allCandidates: Candidate[] = [];
      let lastCursor: string | null = null;
      let hasNextPage = true;
      const timestampedFilter = { projectsId: { eq: firstJob.id } };
      while (hasNextPage) {
        const response = await this.staticGraphQLService.executeGraphQL(
          graphqlToFetchAllCandidateDataWithFieldValues,
          { lastCursor, limit: 400, filter: timestampedFilter, orderBy: [{ createdAt: 'DESC' }] },
          apiToken,
        );
        const candidatesData = response?.data?.data?.candidates as
          | { edges: CandidateEdge[]; pageInfo: PageInfo }
          | undefined;
        if (!candidatesData?.edges?.length) {
          break;
        }
        hasNextPage = candidatesData.pageInfo?.hasNextPage ?? false;
        type CandidateNodeWithPerson = { id: string; person?: { id: string }; phoneNumber?: string | { primaryPhoneNumber: string } };
        allCandidates.push(
          ...candidatesData.edges.map((edge) => {
            const node = edge.node as unknown as CandidateNodeWithPerson;
            const phone = typeof node.phoneNumber === 'string' ? node.phoneNumber : node.phoneNumber?.primaryPhoneNumber;
            return {
              id: node.id,
              personId: node.person?.id ?? '',
              phoneNumber: phone,
            };
          }),
        );
        if (!hasNextPage) break;
        lastCursor = candidatesData.pageInfo?.endCursor ?? null;
      }
      const candidates = allCandidates;
      console.log(`Found ${candidates.length} candidates`);

      // Step 3: Categorize candidates based on phone number availability
      const candidatesWithPhone: Candidate[] = [];
      const candidatesWithoutPhone: Candidate[] = [];

      for (const candidate of candidates) {
        if (candidate.phoneNumber && candidate.phoneNumber.trim() !== '') {
          candidatesWithPhone.push(candidate);
        } else {
          candidatesWithoutPhone.push(candidate);
        }
      }

      if (candidatesWithoutPhone.length === 0) {
        throw new Error('No candidates without phone numbers found');
      }

      // Step 4: Update phone number for first candidate without phone
      const candidateToUpdate = candidatesWithoutPhone[0];
      const updateResponse = await this.candidateService.updateCandidateField(
        candidateToUpdate.personId,
        candidateToUpdate.id,
        'phoneNumber',
        '918411937769',
        apiToken,
        'http://localhost:3000'
      );

      console.log('Updated candidate phone number:', updateResponse);

      // Step 5: Start chat for this candidate
      const startChatResponse = await this.arxChatEndpoint.startChatsByCandidateIds({
        headers: { authorization: `Bearer ${apiToken}` },
        body: { candidateIds: [candidateToUpdate.id] }
      });

      console.log('Started chat:', startChatResponse);

      // Step 6: Check messages
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for messages to be processed

      const messagesResponse = await this.arxChatEndpoint.getWhatsappMessagessByCandidateId({
        headers: { authorization: `Bearer ${apiToken}` },
        body: { candidateId: candidateToUpdate.id }
      });

      const messages = (messagesResponse || []) as Message[];
      
      if (messages.length < 2) {
        throw new Error('Expected at least 2 messages, but found ' + messages.length);
      }

      const hasGlobalRecruitmentMessage = messages.some(msg => 
        msg.content && msg.content.toLowerCase().includes('global recruitment')
      );

      if (!hasGlobalRecruitmentMessage) {
        throw new Error('No message containing "global recruitment" found');
      }

      return {
        status: 'Success',
        message: 'Chat flow test completed successfully',
        details: {
          projectId: firstJob.id,
          candidateId: candidateToUpdate.id,
          messageCount: messages.length
        }
      };

    } catch (error) {
      console.error('Error in test chat flow:', error);
      return {
        status: 'Failed',
        error: error.message
      };
    }
  }
}
