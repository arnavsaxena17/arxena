import { Processor } from 'src/engine/integrations/message-queue/decorators/processor.decorator';
import { Process } from 'src/engine/integrations/message-queue/decorators/process.decorator';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { CandidateService } from '../services/candidate.service';
import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';

interface CandidateProcessingData {
  data: CandidateSourcingTypes.UserProfile[];
  jobId: string;
  jobName: string;
  timestamp: string;
  apiToken: string;
}

@Processor(MessageQueue.candidateProcessingQueue)
export class CandidateProcessingJob {
  constructor(
    private readonly candidateService: CandidateService,
  ) {}

  @Process(CandidateProcessingJob.name)
  async handle(data: CandidateProcessingData) {
    console.log('Processing candidates batch:', {
      candidatesCount: data.data.length,
      jobId: data.jobId,
      timestamp: data.timestamp
    });

    try {
      const result = await this.candidateService.processProfilesWithRateLimiting(
        data.data,
        data.jobId,
        data.jobName,
        data.timestamp,
        data.apiToken
      );

      console.log('Batch processing completed:', {
        newPeople: result.manyPersonObjects.length,
        existingPeople: result.allPersonObjects.length,
        newCandidates: result.manyCandidateObjects.length,
        newJobCandidates: result.manyJobCandidateObjects.length
      });

      return result;
    } catch (error) {
      console.error('Candidate processing job failed:', error);
      throw error;
    }
  }
}