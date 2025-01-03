import { Process } from 'src/engine/integrations/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/integrations/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { CandidateService } from '../services/candidate.service';
import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';

@Processor(MessageQueue.candidateQueue)
export class CandidateQueueProcessor {
  constructor(
    private readonly candidateService: CandidateService,
  ) {
    console.log('CandidateQueueProcessor initialized');
  }

  @Process(CandidateQueueProcessor.name) // Use a specific name for this job type
  async handle(jobCandidateData:CandidateSourcingTypes.ProcessCandidatesJobData): Promise<void> {
    console.log('CandidateQueueProcessor handling job. Processing. Number of candidates to be processed:', jobCandidateData.data.length);
    try {
      const {
        data,
        jobId,
        jobName,
        timestamp,
        apiToken,
      } = jobCandidateData;
      console.log('Processing candidate data. NUumber of profiles are:', data.length);
      const result = await this.candidateService.processProfilesWithRateLimiting(data, jobId, jobName, timestamp, apiToken);
      console.log('Candidate email sent successfully:', result);
    } catch (error) {
      console.error('Candidate email job failed:', error);
      throw error;
    }
  }
}