import { Injectable } from '@nestjs/common';
import {
    createCvsentMutation,
    findManyAttachmentsQuery,
    graphqlToFetchAllCandidateData,
} from 'twenty-shared';

import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { EmailDraftService } from './email-draft.service';
import { ShortlistDocumentService } from './shortlist-document.service';

interface CandidateAttachment {
  id: string;
  name: string;
  fullPath: string;
  type: string;
}

interface EmailAttachment {
  filename: string;
  path: string;
}

export interface ShortlistDocumentResult {
  overall_success: boolean;
  shortlist_path?: string;
  draft_result?: any;
  total_attachments?: number;
  failed_candidates?: Record<string, string>;
  error?: string;
}

@Injectable()
export class GmailDraftShortlistService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly shortlistDocumentService: ShortlistDocumentService,
    private readonly emailDraftService: EmailDraftService,
  ) {}

  async createGmailDraftShortlist(
    candidateIds: string[],
    origin: string,
    apiToken: string,
  ): Promise<ShortlistDocumentResult> {
    try {
      console.log('Creating Gmail draft shortlist for candidates:', candidateIds);

      // Step 1: Get job from candidate IDs
      const job = await this.getJobFromCandidateIds(candidateIds, apiToken);
      if (!job) {
        return {
          overall_success: false,
          error: 'No job found for the provided candidate IDs',
        };
      }

      console.log('Found job:', job.id, job.name);

      // Step 2: Create shortlist document (without Excel file by default)
      const shortlistResult = await this.shortlistDocumentService.createShortlistDocument(
        job,
        candidateIds,
        apiToken,
        origin,
        false, // Don't create Excel file unless specifically requested
      );

      if (!shortlistResult.success) {
        return {
          overall_success: false,
          error: shortlistResult.error || 'Failed to create shortlist document',
        };
      }

      console.log('Shortlist document created:', shortlistResult.shortlist_path);

      // Step 3: Fetch attachments for all candidates
      const allAttachments = await this.fetchAttachmentsForCandidates(
        candidateIds,
        apiToken,
      );

      console.log('Found attachments:', allAttachments.length);

      // Step 4: Create CV sent record
      const cvSentId = await this.createCvSentIfNotExists(job, apiToken);
      if (!cvSentId) {
        return {
          overall_success: false,
          error: 'Failed to create CV sent record',
        };
      }

      // Step 5: Create email draft
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const emailResult = await this.emailDraftService.createDraftEmailWithShortlist(
        currentUser,
        job,
        candidateIds,
        shortlistResult.shortlist_path,
        shortlistResult.excel_path,
        allAttachments,
        cvSentId,
        origin,
        apiToken,
      );

      if (!emailResult.success) {
        return {
          overall_success: false,
          error: emailResult.error || 'Failed to create email draft',
        };
      }

      return {
        overall_success: true,
        shortlist_path: shortlistResult.shortlist_path,
        draft_result: emailResult,
        total_attachments: allAttachments.length + 2, // +2 for shortlist and excel files
      };
    } catch (error) {
      console.error('Error in createGmailDraftShortlist:', error);
      return {
        overall_success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  private async getJobFromCandidateIds(
    candidateIds: string[],
    apiToken: string,
  ): Promise<any> {
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData,
        { filter: { id: { in: candidateIds } } },
        apiToken,
      );

      const candidates = response?.data?.data?.candidates?.edges || [];
      if (candidates.length === 0) {
        return null;
      }

      // Get job from first candidate (assuming all candidates belong to same job)
      const firstCandidate = candidates[0].node;
      return firstCandidate.jobs;
    } catch (error) {
      console.error('Error fetching job from candidate IDs:', error);
      return null;
    }
  }

  private async createCvSentIfNotExists(
    job: any,
    apiToken: string,
  ): Promise<string | null> {
    try {
      // Check if CV sent already exists for this job
      // For now, we'll always create a new one as the original code does
      const cvSentData = {
        input: {
          jobId: job.id,
          name: `CV Sent - ${job.name}`,
          position: "first",
        },
      };

      const response = await this.staticGraphQLService.executeGraphQL(
        createCvsentMutation,
        cvSentData,
        apiToken,
      );

      return response?.data?.data?.createCvSent?.id || null;
    } catch (error) {
      console.error('Error creating CV sent:', error);
      return null;
    }
  }

  private async fetchAttachmentsForCandidates(
    candidateIds: string[],
    apiToken: string,
  ): Promise<CandidateAttachment[]> {
    const allAttachments: CandidateAttachment[] = [];
    const failedCandidates: Record<string, string> = {};

    for (const candidateId of candidateIds) {
      try {
        const response = await this.staticGraphQLService.executeGraphQL(
          findManyAttachmentsQuery,
          {
            filter: { candidateId: { eq: candidateId } },
            orderBy: [{ createdAt: 'DescNullsFirst' }],
          },
          apiToken,
        );

        const attachments = response?.data?.data?.attachments?.edges || [];
        const candidateAttachments = attachments.map((edge: any) => ({
          id: edge.node.id,
          name: edge.node.name,
          fullPath: edge.node.fullPath,
          type: edge.node.type,
        }));

        if (candidateAttachments.length === 0) {
          failedCandidates[candidateId] = 'No attachments found';
        } else {
          allAttachments.push(...candidateAttachments);
        }
      } catch (error) {
        console.error(`Error fetching attachments for candidate ${candidateId}:`, error);
        failedCandidates[candidateId] = error.message || 'Unknown error';
      }
    }

    if (Object.keys(failedCandidates).length > 0) {
      console.log('Failed candidates:', failedCandidates);
    }

    return allAttachments;
  }

}
