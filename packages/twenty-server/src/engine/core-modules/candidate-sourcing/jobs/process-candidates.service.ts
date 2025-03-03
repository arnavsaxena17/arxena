// import { ProcessCandidatesJob } from '../jobs/process-candidates.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { ProcessCandidatesJobData, UserProfile } from 'twenty-shared';
import { CandidateService } from '../services/candidate.service';
import { CandidateQueueProcessor } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.job';

export class ProcessCandidatesService {
  constructor(
  @InjectMessageQueue(MessageQueue.candidateQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly candidateService: CandidateService,
) {}


  // async send(data: UserProfile[],jobId:string, jobName: string, timestamp: string, apiToken: string): Promise<void> {
  //   try {
  //     console.log('Queueing candidate data:');


  //     // const { data, jobId, jobName, timestamp, apiToken, } = jobCandidateData;
  //     // console.log('Processing candidate data. NUumber of profiles are:', data.length);
  //     // const result = await this.candidateService.processProfilesWithRateLimiting(data, jobId, jobName, timestamp, apiToken);

  //     const queueJobOptions: QueueCronJobOptions = {
  //       retryLimit: 3,
  //       priority: 1,
  //       repeat: { every: 1000 },
  //     };

  //     await this.messageQueueService.add<ProcessCandidatesJobData>(
  //       CandidateQueueProcessor.name,
  //       { data, jobId, jobName, timestamp, apiToken },
  //       queueJobOptions,
  //     );



  //   } catch (error) {
  //     console.log('Failed to queue candidate email:', error);
  //     throw error;
  //   }
  // }


  async send(data: UserProfile[], jobId: string, jobName: string, timestamp: string, apiToken: string): Promise<void> {
    try {
      console.log(`Queueing ${data.length} candidates for processing`);
      // For smaller batches, use the main processor
      // if (data.length <= 10) {
      //   const queueJobOptions: QueueCronJobOptions = {
      //     retryLimit: 3,
      //     priority: 1,
      //     repeat: { every: 1000 },
      //   };
      //   await this.messageQueueService.add<ProcessCandidatesJobData>(
      //     CandidateQueueProcessor.name,
      //     { data, jobId, jobName, timestamp, apiToken },
      //     queueJobOptions,
      //   );
      //   return;
      // }
      // For larger batches, break them up
      const batchSize = 30;
      const totalBatches = Math.ceil(data.length / batchSize);
      console.log(`Breaking up ${data.length} candidates into ${totalBatches} batches of ~${batchSize} each`);
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        console.log(`Queueing batch ${batchNumber}/${totalBatches} with ${batch.length} candidates`);
        const queueJobOptions: QueueCronJobOptions = { retryLimit: 3, priority: 1, repeat: { every: 1000 }, };
        // Use a fixed processor name
        // const processorName = 'CandidateQueueProcessor_batch';
        // console.log("This isthe processor name", processorName);
        const batchName = `Batch ${batchNumber}/${totalBatches}`;
        console.log("This isthe processor batch name", batchName);
        console.log("Batch number : ", batchNumber, "has ", batch.length, "candidates", "with unique keys of : ", batch.map((c) => c.unique_key_string));
        const jobData: ProcessCandidatesJobData = { data: batch, jobId, jobName, batchName: batchName, timestamp, apiToken };
        await this.messageQueueService.add<ProcessCandidatesJobData>( CandidateQueueProcessor.name, jobData, queueJobOptions );
      }
      console.log(`Successfully queued ${totalBatches} batches of candidates`);
    } catch (error) {
      console.log('Failed to queue candidate processing:', error);
      throw error;
    }
  }
  
}