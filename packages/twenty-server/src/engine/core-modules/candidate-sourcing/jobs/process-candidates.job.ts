import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';


import { ProcessCandidatesJobData } from 'twenty-shared';
import { CandidateService } from '../services/candidate.service';

@Processor(MessageQueue.candidateQueue)
export class CandidateQueueProcessor {
  constructor(
    private readonly candidateService: CandidateService,
  ) {
    console.log('CandidateQueueProcessor initialized');
  }

  @Process(CandidateQueueProcessor.name) // Use a specific name for this job type
  async handle(jobCandidateData:ProcessCandidatesJobData): Promise<void> {
    console.log('CandidateQueueProcessor handling job. Processing. Number of candidates to be processed:', jobCandidateData.data.length);
    try {
      const { data, jobId, jobName, timestamp, apiToken, } = jobCandidateData;
      console.log('Processing candidate data. NUumber of profiles are:', data.length);
      const result = await this.candidateService.processProfilesWithRateLimiting(data, jobId, jobName, timestamp, apiToken);
      console.log('Candidates processing handled successfully:');
    } catch (error) {
      console.error('Candidate processing job failed:', error);
      throw error;
    }
  }
}