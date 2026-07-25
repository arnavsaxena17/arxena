import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { Semaphore } from '../../arx-chat/utils/semaphore';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

@Injectable()
export class SharedCronOperationsService {
  private readonly maxConcurrency = 50;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  async executeWorkspaceTask(
    callback: (token: string) => Promise<void>,
    isProcessingRef: { current: boolean }
  ) {
    if (isProcessingRef.current) {
      console.log('Previous job still running, skipping');
      return;
    }

    try {
      isProcessingRef.current = true;
      console.log('Starting cycle');
      
      const workspaces = await this.getFilteredWorkspaces();
      console.log(`Processing ${workspaces.length} workspaces`);

      await this.processConcurrently(workspaces, callback);
      
    } catch (error) {
      console.log('Error in job', error);
    } finally {
      isProcessingRef.current = false;
      console.log('Ending cycle');
    }
  }

  private async processConcurrently(
    workspaces: string[],
    callback: (token: string) => Promise<void>,
  ) {
    const semaphore = new Semaphore(this.maxConcurrency);
    
    const processWorkspace = async (workspaceId: string) => {
      await semaphore.acquire();
      try {
        const token = await this.getWorkspaceToken(workspaceId);
        if (token) {
          await callback(token);
        }
      } catch (error) {
        console.error(`Error processing workspace ${workspaceId}:`, error);
      } finally {
        semaphore.release();
      }
    };

    await Promise.all(workspaces.map(processWorkspace));
  }

  private async getFilteredWorkspaces(): Promise<string[]> {
    const workspaceIds = await this.workspaceQueryService.getWorkspaces();
    const dataSources =
      await this.workspaceQueryService.dataSourceRepository.find({
        where: { workspaceId: In(workspaceIds) },
      });

    return Array.from(new Set(dataSources.map((ds) => ds.workspaceId)));
  }

  private async getWorkspaceToken(workspaceId: string): Promise<string | null> {
    const schema =
      this.workspaceQueryService.workspaceDataSourceService.getSchemaName(
        workspaceId,
      );
    const apiKeys = await this.workspaceQueryService.getApiKeys(
      workspaceId,
      schema,
    );
    if (!apiKeys || !apiKeys.length) return null;
    const token =
      await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
        workspaceId,
        apiKeys[0].id,
      );
    return token?.token || null;
  }
} 