import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { In } from 'typeorm';

import { CandidateEngagementArx } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { TimeManagement } from '../../arx-chat/services/time-management';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

const CRON_DISABLED = process.env.NODE_ENV === 'production' ? false : false;
const WORKSPACE_TIMEOUT_MS = 1.5 * 60 * 1000;
const MAX_CONCURRENT_WORKSPACES = 2;

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

@Injectable()
export class CandidateEngagementCronService {
  private isProcessing = false;
  private readonly logger = new Logger(CandidateEngagementCronService.name);
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  private async processWorkspaceWithTimeout(
    workspaceId: string,
    schema: string,
  ): Promise<void> {
    const startTime = Date.now();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => { reject(new Error(`Timeout processing workspace ${workspaceId}`)); }, WORKSPACE_TIMEOUT_MS);
    });
    const processingPromise = async () => {
      const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, schema);
      if (!apiKeys.length) {
        this.logger.warn(`No API keys found for workspace ${workspaceId}`);
        return;
      }
      const token = await this.workspaceQueryService.apiKeyService.generateApiKeyToken(workspaceId, apiKeys[0].id);
      if (!token?.token) {
        this.logger.warn(`Could not generate token for workspace ${workspaceId}`);
        return;
      }
      await new CandidateEngagementArx( this.workspaceQueryService, this.staticGraphQLService ).executeCandidateEngagement(token.token);
    };

    try {
      await Promise.race([processingPromise(), timeoutPromise]);
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      console.log(`Individual Workspace ${workspaceId} processing time in ${processingTime}ms`);
      this.logger.log(`Successfully processed workspace ${workspaceId}`);
    } catch (error) {
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      console.log(`Workspace ${workspaceId} failed after ${processingTime}ms`);
      if (error.message.includes('Timeout')) {
        this.logger.error(`Timeout processing workspace ${workspaceId}`);
      } else {
        this.logger.error(`Error processing workspace ${workspaceId}:`, error);
      }
      throw error;
    }
  }
  private async processBatch(workspaces: Array<{ id: string; schema: string }>) {
    const batchStartTime = Date.now();
    console.log(`Starting batch processing for ${workspaces.length} workspaces`);
    const results = await Promise.allSettled(
      workspaces.map(({ id, schema }) =>
        this.processWorkspaceWithTimeout(id, schema),
      ),
    );
    const batchEndTime = Date.now();
    const batchProcessingTime = batchEndTime - batchStartTime;
    console.log(`Batch processed in ${batchProcessingTime}ms (${workspaces.length} workspaces)`);
    
    results.forEach((result, index) => {
      const workspaceId = workspaces[index].id;
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to process workspace ${workspaceId}: ${result.reason}`,
        );
      }
    });
  }
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
      this.logger.log(`Will process ${filteredWorkspaces.length} workspaces after filtering`);
      for (let i = 0; i < filteredWorkspaces.length; i += MAX_CONCURRENT_WORKSPACES) {
        const batch = filteredWorkspaces.slice(i, i + MAX_CONCURRENT_WORKSPACES);
        await this.processBatch(batch);
        if (i + MAX_CONCURRENT_WORKSPACES < filteredWorkspaces.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      const overallEndTime = Date.now();
      const overallProcessingTime = overallEndTime - overallStartTime;
      console.log(`Total processing time for all workspaces: ${overallProcessingTime}ms`);
    } catch (error) {
      this.logger.error('Error in candidate engagement job:', error);
    } finally {
      this.isProcessing = false;
      this.logger.log('Ending candidate engagement cycle');
    }
  }
}