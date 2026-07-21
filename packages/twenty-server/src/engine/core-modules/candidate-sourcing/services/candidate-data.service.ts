import { Injectable, Logger } from '@nestjs/common';
import {
    getResolvedOtherFields,
    graphqlToFetchAllCandidateDataWithFieldValues,
    otherFieldsToFlatRow,
} from 'twenty-shared';

import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { streamToBuffer } from 'src/utils/stream-to-buffer';

import { ResumeReadParseUploadService } from './resume-read-parse-upload.service';

export type CandidateAttachmentMeta = {
  id?: string;
  name?: string;
  fullPath?: string;
  type?: string;
};

export interface CandidateData {
  id: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  status?: string;
  jobTitle?: string;
  resume?: string;
  _attachments?: CandidateAttachmentMeta[];
  [key: string]: any;
}

const RESUME_EXTENSIONS = ['.pdf', '.docx', '.doc'];
const MAX_RESUME_CHARS = 40_000;

@Injectable()
export class CandidateDataService {
  private readonly logger = new Logger(CandidateDataService.name);

  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly fileStorageService: FileStorageService,
    private readonly resumeReadParseUploadService: ResumeReadParseUploadService,
  ) {}

  async fetchCandidatesForJob(
    jobId: string,
    selectedRecordIds: string[] = [],
    apiToken: string,
    options?: { includeResumeText?: boolean },
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
      
      const processedCandidates = this.processCandidateData(allCandidates);

      if (options?.includeResumeText) {
        await this.attachResumeTextToCandidates(processedCandidates);
      } else {
        for (const candidate of processedCandidates) {
          delete candidate._attachments;
        }
      }
      
      return processedCandidates;
    } catch (error) {
      console.error('Error fetching candidate data:', error);
      return [];
    }
  }

  /**
   * Load CV attachment text onto each candidate as `resume` for AI filter context.
   */
  async attachResumeTextToCandidates(
    candidates: CandidateData[],
  ): Promise<void> {
    for (const candidate of candidates) {
      try {
        const resumeText = await this.loadResumeTextForCandidate(candidate);
        if (resumeText) {
          candidate.resume = resumeText;
          this.logger.log(
            `Attached resume text for candidate ${candidate.id} (${resumeText.length} chars)`,
          );
        } else {
          this.logger.warn(
            `No readable resume attachment found for candidate ${candidate.id}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to load resume for candidate ${candidate.id}: ${(error as Error).message}`,
        );
      } finally {
        delete candidate._attachments;
      }
    }
  }

  private async loadResumeTextForCandidate(
    candidate: CandidateData,
  ): Promise<string | null> {
    const attachment = this.pickResumeAttachment(candidate._attachments || []);
    if (!attachment?.fullPath) {
      return null;
    }

    const normalizedPath = this.normalizeAttachmentPath(attachment.fullPath);
    const fileName =
      attachment.name ||
      normalizedPath.split('/').pop() ||
      'resume.pdf';

    if (!this.resumeReadParseUploadService.isSupportedResumeFormat(fileName)) {
      this.logger.warn(
        `Unsupported resume format for candidate ${candidate.id}: ${fileName}`,
      );
      return null;
    }

    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    const folderPath =
      lastSlashIndex >= 0 ? normalizedPath.substring(0, lastSlashIndex) : '';
    const storageFileName =
      lastSlashIndex >= 0
        ? normalizedPath.substring(lastSlashIndex + 1)
        : normalizedPath;

    const fileStream = await this.fileStorageService.read({
      folderPath,
      filename: storageFileName,
    });
    const buffer = await streamToBuffer(fileStream);
    const content = await this.resumeReadParseUploadService.readResumeFromBuffer(
      buffer,
      fileName,
    );

    if (!content.text?.trim()) {
      return null;
    }

    return this.truncateResumeText(content.text);
  }

  private pickResumeAttachment(
    attachments: CandidateAttachmentMeta[],
  ): CandidateAttachmentMeta | null {
    const withPath = attachments.filter((att) => Boolean(att?.fullPath));
    if (withPath.length === 0) {
      return null;
    }

    const byExtension = withPath.find((att) => {
      const name = (att.name || att.fullPath || '').toLowerCase();
      return RESUME_EXTENSIONS.some((ext) => name.includes(ext));
    });

    if (byExtension) {
      return byExtension;
    }

    const byType = withPath.find((att) => {
      const type = (att.type || '').toLowerCase();
      return (
        type.includes('pdf') ||
        type.includes('doc') ||
        type.includes('resume') ||
        type.includes('cv')
      );
    });

    return byType || withPath[0];
  }

  private normalizeAttachmentPath(fullPath: string): string {
    if (!fullPath) {
      return fullPath;
    }
    let path = fullPath.split('?')[0];
    const filesMarker = '/files/';
    const filesIdx = path.indexOf(filesMarker);
    if (filesIdx >= 0) {
      path = path.substring(filesIdx + filesMarker.length);
    }
    return path;
  }

  private truncateResumeText(text: string): string {
    if (text.length <= MAX_RESUME_CHARS) {
      return text;
    }
    return `${text.slice(0, MAX_RESUME_CHARS)}\n\n[Resume truncated for token limits]`;
  }

  private processCandidateData(rawCandidates: any[]): CandidateData[] {
    return rawCandidates.map(candidate => {
      const jobTitleFromCandidate =
        (typeof candidate.jobTitle === 'string' && candidate.jobTitle.trim()) ||
        (candidate.people && typeof candidate.people.jobTitle === 'string' && candidate.people.jobTitle.trim()) ||
        '';
      const attachments: CandidateAttachmentMeta[] = (
        candidate.attachments?.edges || []
      )
        .map((edge: any) => edge?.node)
        .filter(Boolean)
        .map((node: any) => ({
          id: node.id,
          name: node.name,
          fullPath: node.fullPath,
          type: node.type,
        }));

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
        _attachments: attachments,
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
