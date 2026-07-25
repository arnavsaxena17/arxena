import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { In } from 'typeorm';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { TimeManagement } from '../../arx-chat/services/time-management';
import { InjectMessageQueue } from '../../message-queue/decorators/message-queue.decorator';
import { QueueJobOptions } from '../../message-queue/drivers/interfaces/job-options.interface';
import { MessageQueue } from '../../message-queue/message-queue.constants';
import { MessageQueueService } from '../../message-queue/services/message-queue.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { CandidateEngagementProcessor } from './candidate-engagement-processor.job';

const CRON_DISABLED = true; // Disabled in favor of event-driven processing via queue

// Arrays to control which workspaces to process
const WORKSPACES_TO_IGNORE: string[] = [
  // Add workspace IDs to ignore here
  // Example: 'workspace-id-to-ignore-1',
  // Example: 'workspace-id-to-ignore-2',
];

const SPECIFIC_WORKSPACES_TO_EXECUTE: string[] = [
  // 'fe44a968-cba2-429c-b9a1-73869e852a9c',
  // Add specific workspace IDs to execute here
  // If this array is empty, all workspaces (except ignored ones) will be processed
  // If this array has values, only these workspaces will be processed
  // Example: 'specific-workspace-id-1',
  // Example: 'specific-workspace-id-2',
];

export interface CandidateEngagementJobData {
  workspaceId: string;
  schema: string;
  runId: string;
  timestamp: number;
}

@Injectable()
export class CandidateEngagementCronService {
  private isProcessing = false;
  private currentWorkspaceIndex = 0; // Track current position in workspace rotation
  private readonly logger = new Logger(CandidateEngagementCronService.name);
  
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    @InjectMessageQueue(MessageQueue.candidateEngagementQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  private filterWorkspaces(workspaces: Array<{ id: string; schema: string }>): Array<{ id: string; schema: string }> {
    let filteredWorkspaces = workspaces;
    if (WORKSPACES_TO_IGNORE.length > 0) {
      filteredWorkspaces = filteredWorkspaces.filter(
        workspace => !WORKSPACES_TO_IGNORE.includes(workspace.id)
      );
      this.logger.log(`Filtered out ${workspaces.length - filteredWorkspaces.length} ignored workspaces`);
    }
    if (SPECIFIC_WORKSPACES_TO_EXECUTE.length > 0) {
      const beforeSpecificFilter = filteredWorkspaces.length;
      filteredWorkspaces = filteredWorkspaces.filter(
        workspace => SPECIFIC_WORKSPACES_TO_EXECUTE.includes(workspace.id)
      );
      this.logger.log(`Filtered to ${filteredWorkspaces.length} specific workspaces (from ${beforeSpecificFilter} available)`);
    }
    return filteredWorkspaces;
  }

  private getWorkspacesForCurrentRun(allWorkspaces: Array<{ id: string; schema: string }>): Array<{ id: string; schema: string }> {
    const { workspacesPerRun } = TimeManagement.workspaceSpreading;
    
    if (allWorkspaces.length === 0) {
      return [];
    }

    // Calculate the subset of workspaces to process in this run
    const startIndex = this.currentWorkspaceIndex;
    const endIndex = Math.min(startIndex + workspacesPerRun, allWorkspaces.length);
    
    // Get workspaces for current run (handle wrap-around)
    let workspacesForRun: Array<{ id: string; schema: string }> = [];
    
    if (endIndex > startIndex) {
      // Normal case: get workspaces from startIndex to endIndex
      workspacesForRun = allWorkspaces.slice(startIndex, endIndex);
    } else {
      // Wrap-around case: get remaining workspaces from startIndex to end, then from beginning
      workspacesForRun = [
        ...allWorkspaces.slice(startIndex),
        ...allWorkspaces.slice(0, endIndex)
      ];
    }

    // Update the index for next run
    this.currentWorkspaceIndex = (this.currentWorkspaceIndex + workspacesPerRun) % allWorkspaces.length;
    
    this.logger.log(`Processing workspaces ${startIndex + 1}-${Math.min(startIndex + workspacesPerRun, allWorkspaces.length)} of ${allWorkspaces.length} (round-robin position: ${this.currentWorkspaceIndex})`);
    
    return workspacesForRun;
  }

  private async queueWorkspaceForProcessing(workspace: { id: string; schema: string }, runId: string): Promise<void> {
    const jobData: CandidateEngagementJobData = {
      workspaceId: workspace.id,
      schema: workspace.schema,
      runId,
      timestamp: Date.now(),
    };

    const queueOptions: QueueJobOptions = {
      retryLimit: TimeManagement.queueSettings.maxRetries,
      priority: 1,
      id: `candidate-engagement-${workspace.id}-${runId}`,
    };

    try {
      console.log(`Adding job to queue with name: ${CandidateEngagementProcessor.name}`);
      console.log(`Job data:`, jobData);
      console.log(`Queue options:`, queueOptions);
      
      await this.messageQueueService.add<CandidateEngagementJobData>(
        CandidateEngagementProcessor.name,
        jobData,
        queueOptions,
      );
      this.logger.log(`Queued workspace ${workspace.id} for processing`);
      
      // Add delay between queue jobs to spread out processing
      await new Promise((resolve) => setTimeout(resolve, TimeManagement.queueSettings.queueJobDelayMs));
    } catch (error) {
      this.logger.error(`Failed to queue workspace ${workspace.id}:`, error);
    }
  }

  @Cron(TimeManagement.crontabs.crontTabToExecuteCandidateEngagement, {
    name: 'candidate-engagement-task',
    disabled: CRON_DISABLED,
  })
  async handleCron() {
    if (this.isProcessing) {
      this.logger.warn('Previous job still running, skipping');
      return;
    }
    try {
      this.isProcessing = true;
      const overallStartTime = Date.now();
      const runId = `run-${Date.now()}`;
      
      this.logger.log('Starting candidate engagement cycle');
      
      const workspaceIds = await this.workspaceQueryService.getWorkspaces();
      console.log("These are all the workspaces::", workspaceIds);
      
      const dataSources = await this.workspaceQueryService.dataSourceRepository.find({
        where: { workspaceId: In(workspaceIds) },
      });
      
      const uniqueWorkspaces = Array.from(
        new Set(dataSources.map((ds) => ds.workspaceId)),
      ).map((id) => ({
        id,
        schema: this.workspaceQueryService.workspaceDataSourceService.getSchemaName(id),
      }));
      
      const filteredWorkspaces = this.filterWorkspaces(uniqueWorkspaces);
      if (filteredWorkspaces.length === 0) {
        this.logger.warn('No workspaces to process after filtering');
        return;
      }

      // Get only a subset of workspaces for this run
      const workspacesForCurrentRun = this.getWorkspacesForCurrentRun(filteredWorkspaces);
      
      if (workspacesForCurrentRun.length === 0) {
        this.logger.warn('No workspaces selected for current run');
        return;
      }

      this.logger.log(`Will queue ${workspacesForCurrentRun.length} workspaces out of ${filteredWorkspaces.length} total workspaces for processing`);
      
      // Queue each workspace for individual processing
      const queuePromises = workspacesForCurrentRun.map(workspace => 
        this.queueWorkspaceForProcessing(workspace, runId)
      );
      
      await Promise.all(queuePromises);
      
      const overallEndTime = Date.now();
      const overallProcessingTime = overallEndTime - overallStartTime;
      console.log(`Total queueing time for current run: ${overallProcessingTime}ms`);
      this.logger.log(`Successfully queued ${workspacesForCurrentRun.length} workspaces for processing`);
      
    } catch (error) {
      this.logger.error('Error in candidate engagement job:', error);
    } finally {
      this.isProcessing = false;
      this.logger.log('Ending candidate engagement cycle');
    }
  }
}