import { Injectable } from '@nestjs/common';
import {
    getResolvedOtherFields,
    graphqlToFetchAllCandidateDataWithFieldValues,
    otherFieldsToFlatRow,
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
    console.log('Selected record IDs for fetching candidates for job for enrichment:', jobId, selectedRecordIds);
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
      const jobTitleFromCandidate =
        (typeof candidate.jobTitle === 'string' && candidate.jobTitle.trim()) ||
        (candidate.people && typeof candidate.people.jobTitle === 'string' && candidate.people.jobTitle.trim()) ||
        '';
      const baseData: CandidateData = {
        id: candidate.id,
        name: candidate.name || 'N/A',
        phoneNumber: candidate.phoneNumber || 'N/A',
        email: candidate.email || 'N/A',
        status: candidate.status || 'N/A',
        jobTitle: jobTitleFromCandidate || 'N/A',
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

      const baseDataKeys = new Set(Object.keys(baseData));
      const resolvedOtherFields = getResolvedOtherFields(candidate);
      const flatOtherFields = otherFieldsToFlatRow(resolvedOtherFields);

      for (const [fieldName, fieldValue] of Object.entries(flatOtherFields)) {
        if (baseDataKeys.has(fieldName)) {
          continue;
        }

        baseData[fieldName] = fieldValue;
      }

      // Use headline/job_title from custom fields when jobTitle is still N/A (for org chart std_grade/std_function)
      const titleFromField =
        (typeof baseData.headline === 'string' && baseData.headline.trim()) ||
        (typeof baseData.job_title === 'string' && baseData.job_title.trim()) ||
        (typeof baseData.linkedin_headline === 'string' && baseData.linkedin_headline.trim()) ||
        '';
      if (titleFromField && (baseData.jobTitle === 'N/A' || !baseData.jobTitle)) {
        baseData.jobTitle = titleFromField;
      }

      return baseData;
    });
  }
}
