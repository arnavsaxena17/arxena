import { GmailDraftShortlistJobData } from 'twenty-shared';

import { ResumeReadParseUploadService } from 'src/engine/core-modules/candidate-sourcing/services/resume-read-parse-upload.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { CandidateDataProcessorService } from './candidate-data-processor.service';
import { DocumentTemplateService } from './document-template.service';
import { EmailDraftService } from './email-draft.service';
import { GmailDraftShortlistService } from './gmail-draft-shortlist.service';
import { ShortlistDocumentService } from './shortlist-document.service';

@Processor(MessageQueue.gmailDraftShortlistQueue)
export class GmailDraftShortlistQueueProcessor {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly resumeReadParseUploadService: ResumeReadParseUploadService,
  ) { 
    console.log('GmailDraftShortlistQueueProcessor initialized'); 
  }
  
  @Process('GmailDraftShortlistQueueProcessor')
  async handle(jobData: GmailDraftShortlistJobData): Promise<void> {
    const batchInfo = jobData?.batchName?.includes('Batch')
      ? jobData.batchName.match(/Batch (\d+)\/(\d+)/)
      : null;

    const batchNumber = batchInfo ? parseInt(batchInfo[1]) : 0;
    const totalBatches = batchInfo ? parseInt(batchInfo[2]) : '?';

    console.log(
      `Processing Gmail draft shortlist batch ${batchNumber}/${totalBatches} for ${jobData.candidateIds.length} candidates`,
    );

    try {
      console.log(
        'Received in GmailDraftShortlistQueueProcessor batch process chunk ::',
        jobData.candidateIds,
      );

      // Create service instances
      const candidateDataProcessor = new CandidateDataProcessorService(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.resumeReadParseUploadService,
      );

      const documentTemplateService = new DocumentTemplateService();

      const shortlistDocumentService = new ShortlistDocumentService(
        this.workspaceQueryService,
        this.staticGraphQLService,
        candidateDataProcessor,
        documentTemplateService,
      );

      const emailDraftService = new EmailDraftService(
        this.workspaceQueryService,
        this.staticGraphQLService,
      );

      const gmailDraftService = new GmailDraftShortlistService(
        this.workspaceQueryService,
        this.staticGraphQLService,
        shortlistDocumentService,
        emailDraftService,
      );

      const result = await gmailDraftService.createGmailDraftShortlist(
        jobData.candidateIds,
        jobData.origin,
        jobData.apiToken,
      );

      console.log(
        `Successfully processed Gmail draft shortlist batch ${batchNumber}/${totalBatches}`,
        result,
      );

    } catch (error) {
      console.error(
        `Gmail draft shortlist batch ${batchNumber}/${totalBatches} processing failed:`,
        error,
      );
      throw error;
    }
  }
}
