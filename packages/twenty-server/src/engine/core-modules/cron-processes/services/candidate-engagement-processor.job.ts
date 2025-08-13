import { CandidateEngagementArx } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { Process } from '../../message-queue/decorators/process.decorator';
import { Processor } from '../../message-queue/decorators/processor.decorator';
import { MessageQueue } from '../../message-queue/message-queue.constants';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { CandidateEngagementJobData } from './candidate-engagement-cron.service';

const WORKSPACE_TIMEOUT_MS = 1.5 * 60 * 1000;

@Processor(MessageQueue.candidateEngagementQueue)
export class CandidateEngagementProcessor {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {
    console.log('CandidateEngagementProcessor initialized');
  }

  @Process(CandidateEngagementProcessor.name)
  async handle(jobData: CandidateEngagementJobData): Promise<void> {
    console.log('CandidateEngagementProcessor.handle() called with jobData:', jobData);
    
    const { workspaceId, schema, runId, timestamp } = jobData;
    const startTime = Date.now();
    
    console.log(`Starting candidate engagement processing for workspace ${workspaceId} (run: ${runId})`);

    // Validate workspaceId
    if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
      console.error(`Invalid workspaceId:`, workspaceId);
      throw new Error(`Invalid workspaceId: ${workspaceId}`);
    }

    // Validate schema
    if (!schema || typeof schema !== 'string') {
      console.error(`Invalid schema for workspace ${workspaceId}:`, schema);
      throw new Error(`Invalid schema for workspace ${workspaceId}`);
    }

    try {
      // Set up timeout for the entire processing
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => { 
          reject(new Error(`Timeout processing workspace ${workspaceId}`)); 
        }, WORKSPACE_TIMEOUT_MS);
      });

      const processingPromise = async () => {
        try {
          // Get API keys for the workspace
          console.log(`Fetching API keys for workspace ${workspaceId} with schema ${schema}`);
          const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, schema);
          console.log(`API keys result for workspace ${workspaceId}:`, apiKeys);
          
          if (!apiKeys || !apiKeys.length) {
            console.log(`No API keys found for workspace ${workspaceId}`);
            return;
          }

          console.log(`Found ${apiKeys.length} API keys for workspace ${workspaceId}`);

          // Generate token for the workspace
          const token = await this.workspaceQueryService.apiKeyService.generateApiKeyToken(workspaceId, apiKeys[0].id);
          if (!token?.token) {
            console.log(`Could not generate token for workspace ${workspaceId}`);
            return;
          }

          console.log(`Generated token for workspace ${workspaceId}, executing candidate engagement`);

          // Execute candidate engagement
          await new CandidateEngagementArx(
            this.workspaceQueryService, 
            this.staticGraphQLService
          ).executeCandidateEngagement(token.token);
        } catch (error) {
          console.error(`Error in processingPromise for workspace ${workspaceId}:`, error);
          throw error; // Re-throw to be caught by the outer try-catch
        }
      };

      // Race between processing and timeout
      await Promise.race([processingPromise(), timeoutPromise]);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      console.log(`Workspace ${workspaceId} processing completed in ${processingTime}ms`);
      console.log(`Successfully processed workspace ${workspaceId} (run: ${runId})`);
      
    } catch (error) {
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      console.log(`Workspace ${workspaceId} failed after ${processingTime}ms`);
      console.log(`Error details for workspace ${workspaceId}:`, {
        error: error.message,
        stack: error.stack,
        workspaceId,
        schema,
        runId,
        timestamp
      });
      
      if (error.message.includes('Timeout')) {
        console.error(`Timeout processing workspace ${workspaceId} (run: ${runId})`);
      } else if (error.message.includes('connection') || error.message.includes('database')) {
        console.error(`Database connection error processing workspace ${workspaceId} (run: ${runId}):`, error.message);
      } else if (error.message.includes('table') || error.message.includes('schema')) {
        console.error(`Schema/table error processing workspace ${workspaceId} (run: ${runId}):`, error.message);
      } else {
        console.error(`Error processing workspace ${workspaceId} (run: ${runId}):`, error);
      }
      
      // Re-throw the error so the queue can handle retries
      throw error;
    }
  }
} 