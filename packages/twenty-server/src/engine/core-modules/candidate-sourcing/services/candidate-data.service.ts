import { Injectable } from '@nestjs/common';
import {
  graphqlToFetchAllCandidateDataWithFieldValues,
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';

export interface CandidateData {
  id: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  status?: string;
  jobTitle?: string;
  [key: string]: any;
}

@Injectable()
export class CandidateDataService {
  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async fetchCandidatesForJob(
    jobId: string,
    selectedRecordIds: string[] = [],
    apiToken: string
  ): Promise<CandidateData[]> {
    console.log('Fetching candidates for job:', jobId);
    
    try {
      const filterParams = selectedRecordIds.length > 0 
        ? { id: { in: selectedRecordIds } }
        : { jobsId: { eq: jobId } };

      const variables = {
        filter: filterParams,
        orderBy: [{ updatedAt: 'DESC' }],
        limit: 60
      };

      const allCandidates: any[] = [];
      let lastCursor: string | null = null;
      let hasMoreResults = true;

      while (hasMoreResults) {
        if (lastCursor) {
          variables['lastCursor'] = lastCursor;
        }

        const response = await this.staticGraphQLService.executeGraphQL(
          graphqlToFetchAllCandidateDataWithFieldValues,
          variables,
          apiToken
        );

        if (response.data?.errors) {
          console.error('Error fetching candidates:', response.data.errors);
          break;
        }

        const edges = response.data?.data?.candidates?.edges || [];

        if (!edges.length) {
          break;
        }

        allCandidates.push(...edges.map((edge: any) => edge.node || {}));
        hasMoreResults = edges.length === 60;
        
        if (edges.length && hasMoreResults) {
          lastCursor = edges[edges.length - 1].cursor;
        } else {
          break;
        }
      }

      console.log(`Fetched ${allCandidates.length} candidates`);
      
      // Process candidates to flatten the data structure
      const processedCandidates = this.processCandidateData(allCandidates);
      
      return processedCandidates;
    } catch (error) {
      console.error('Error fetching candidate data:', error);
      return [];
    }
  }

  private processCandidateData(rawCandidates: any[]): CandidateData[] {
    return rawCandidates.map(candidate => {
      const baseData: CandidateData = {
        id: candidate.id,
        name: candidate.name || 'N/A',
        phoneNumber: candidate.phoneNumber || 'N/A',
        email: candidate.email || 'N/A',
        status: candidate.status || 'N/A',
        jobTitle: candidate.people?.jobTitle || 'N/A',
        chatCount: candidate.chatCount || 'N/A',
        clientInterview: candidate.clientInterview || 'N/A',
        hiringNaukriUrl: candidate.hiringNaukriUrl || 'N/A',
        lastEngagementChatControl: candidate.lastEngagementChatControl || 'N/A',
        resdexNaukriUrl: candidate.resdexNaukriUrl || 'N/A',
        source: candidate.source || 'N/A',
        startChat: candidate.startChat || 'N/A',
        startChatCompleted: candidate.startChatCompleted || 'N/A',
        startMeetingSchedulingChat: candidate.startMeetingSchedulingChat || 'N/A',
        startMeetingSchedulingChatCompleted: candidate.startMeetingSchedulingChatCompleted || 'N/A',
        startVideoInterviewChat: candidate.startVideoInterviewChat || 'N/A',
        startVideoInterviewChatCompleted: candidate.startVideoInterviewChatCompleted || 'N/A',
        stopChat: candidate.stopChat || 'N/A',
        linkedinUrl: candidate.linkedinUrl || 'N/A',
      };

      // Add candidate field values as flattened properties
      const candidateFieldValues = candidate.candidateFieldValues?.edges || [];
      
      for (const edge of candidateFieldValues) {
        const node = edge.node;
        if (node?.candidateFields?.name && node.name !== null) {
          const fieldName = node.candidateFields.name;
          let fieldValue = node.name;

          // Try to parse JSON values
          if (typeof fieldValue === 'string') {
            try {
              fieldValue = JSON.parse(fieldValue);
            } catch {
              // Keep as string if not valid JSON
            }
          }

          baseData[fieldName] = fieldValue;
        }
      }

      return baseData;
    });
  }

  async getApiKeys(apiToken: string): Promise<{ openaikey: string }> {
    try {
      console.log('Fetching API keys from workspace');
      
      // We'll need to implement this endpoint or use an existing one
      // For now, we'll throw an error to indicate this needs to be implemented
      throw new Error('API keys endpoint not implemented yet - please provide OpenAI key directly');
      
    } catch (error) {
      console.error('Error fetching API keys:', error);
      throw error;
    }
  }
}
