import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { DataSource, EntityManager } from 'typeorm';

import { TypeORMService } from 'src/database/typeorm/typeorm.service';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';

const DEFAULT_IDLE_TTL_MS = 5 * 60 * 1000;
const parsedIdleTtl = Number(process.env.WORKSPACE_DATASOURCE_IDLE_TTL_MS);
const WORKSPACE_IDLE_TTL_MS =
  Number.isFinite(parsedIdleTtl) && parsedIdleTtl > 0
    ? parsedIdleTtl
    : DEFAULT_IDLE_TTL_MS;

@Injectable()
export class WorkspaceDataSourceService implements OnModuleDestroy {
  private workspaceToDataSourceId = new Map<string, string>();
  private workspaceReleaseTimers = new Map<string, NodeJS.Timeout>();
  private workspaceUsageCount = new Map<string, number>();
  private readonly workspaceIdleTtl = WORKSPACE_IDLE_TTL_MS;

  constructor(
    private readonly dataSourceService: DataSourceService,
    private readonly typeormService: TypeORMService,
  ) {}

  /**
   *
   * Connect to the workspace data source
   *
   * @param workspaceId
   * @returns
   */
  public async connectToWorkspaceDataSource(
    workspaceId: string,
  ): Promise<DataSource> {
    const { dataSource, dataSourceMetadata } =
      await this.connectedToWorkspaceDataSourceAndReturnMetadata(workspaceId);

    if (dataSourceMetadata?.id) {
      this.workspaceToDataSourceId.set(workspaceId, dataSourceMetadata.id);
    }

    this.markWorkspaceActive(workspaceId);

    if ((this.workspaceUsageCount.get(workspaceId) ?? 0) === 0) {
      this.scheduleWorkspaceRelease(workspaceId);
    }

    return dataSource;
  }

  public async checkSchemaExists(workspaceId: string) {
    const dataSource =
      await this.dataSourceService.getDataSourcesMetadataFromWorkspaceId(
        workspaceId,
      );

    return dataSource.length > 0;
  }

  public async connectedToWorkspaceDataSourceAndReturnMetadata(
    workspaceId: string,
  ): Promise<{ dataSource: DataSource; dataSourceMetadata: DataSourceEntity }> {
    const dataSourceMetadata =
      await this.dataSourceService.getLastDataSourceMetadataFromWorkspaceIdOrFail(
        workspaceId,
      );

    const dataSource =
      await this.typeormService.connectToDataSource(dataSourceMetadata);
      // console.log("This is the dataSourceMetadata", dataSourceMetadata)
      // console.log("This is the dataSource", dataSource)
    if (!dataSource) {
      throw new Error(
        `Could not connect to workspace data source for workspace ${workspaceId}`,
      );
    }

    return { dataSource, dataSourceMetadata };
  }

  public async releaseWorkspaceDataSource(workspaceId: string): Promise<void> {
    this.clearWorkspaceReleaseTimer(workspaceId);
    this.workspaceUsageCount.delete(workspaceId);
    const dataSourceId = this.workspaceToDataSourceId.get(workspaceId);

    if (!dataSourceId) {
      return;
    }

    try {
      await this.typeormService.disconnectFromDataSource(dataSourceId);
    } catch (error) {
      console.warn(
        `Failed to release workspace data source for workspace ${workspaceId}:`,
        error,
      );
    } finally {
      this.workspaceToDataSourceId.delete(workspaceId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const workspaceId of this.workspaceReleaseTimers.keys()) {
      this.clearWorkspaceReleaseTimer(workspaceId);
    }

    const workspaceIds = [...this.workspaceToDataSourceId.keys()];

    for (const workspaceId of workspaceIds) {
      await this.releaseWorkspaceDataSource(workspaceId);
    }
  }

  /**
   *
   * Create a new DB schema for a workspace
   *
   * @param workspaceId
   * @returns
   */
  public async createWorkspaceDBSchema(workspaceId: string): Promise<string> {
    const schemaName = this.getSchemaName(workspaceId);
    return await this.typeormService.createSchema(schemaName);
  }

  /**
   * Ensures typeorm_metadata table exists in the workspace schema.
   * Safe to call before running workspace migrations (idempotent).
   *
   * @param workspaceId
   */
  public async ensureTypeormMetadataTable(workspaceId: string): Promise<void> {
    const schemaName = this.getSchemaName(workspaceId);
    await this.typeormService.ensureTypeormMetadataTable(schemaName);
  }

  /**
   *
   * Delete a DB schema for a workspace
   *
   * @param workspaceId
   * @returns
   */
  public async deleteWorkspaceDBSchema(workspaceId: string): Promise<void> {
    const schemaName = this.getSchemaName(workspaceId);

    return await this.typeormService.deleteSchema(schemaName);
  }

  /**
   *
   * Get the schema name for a workspace
   * Note: This is assuming that the workspace only has one schema but we should prefer querying the metadata table instead.
   *
   * @param workspaceId
   * @returns string
   */
  public getSchemaName(workspaceId: string): string {
    
    return `workspace_${this.uuidToBase36(workspaceId)}`;
  }

  /**
   *
   * Convert a uuid to base36
   *
   * @param uuid
   * @returns string
   */
  private uuidToBase36(uuid: string): string {
    let devId = false;

    if (uuid.startsWith('twenty-')) {
      devId = true;
      // Clean dev uuids (twenty-)
      uuid = uuid.replace('twenty-', '');
    }
    const hexString = uuid.replace(/-/g, '');
    const base10Number = BigInt('0x' + hexString);
    const base36String = base10Number.toString(36);

    return `${devId ? 'twenty_' : ''}${base36String}`;
  }

  public async executeRawQuery(
    query: string,
    parameters: any[] = [],
    workspaceId: string,
    transactionManager?: EntityManager,
  ): Promise<any> {
    const trackUsage = !transactionManager;

    if (trackUsage) {
      this.incrementUsage(workspaceId);
    }

    try {
      if (transactionManager) {
        return await transactionManager.query(query, parameters);
      }

      const workspaceDataSource =
        await this.connectToWorkspaceDataSource(workspaceId);

      return await workspaceDataSource.query(query, parameters);
    } catch (error) {
      throw new Error(
        `Error executing raw query for workspace ${workspaceId}: ${error.message}`,
      );
    } finally {
      if (trackUsage) {
        this.decrementUsage(workspaceId);
      }
    }
  }

  private incrementUsage(workspaceId: string): void {
    const nextCount = (this.workspaceUsageCount.get(workspaceId) ?? 0) + 1;
    this.workspaceUsageCount.set(workspaceId, nextCount);
    this.markWorkspaceActive(workspaceId);
  }

  private decrementUsage(workspaceId: string): void {
    const nextCount = (this.workspaceUsageCount.get(workspaceId) ?? 0) - 1;

    if (nextCount <= 0) {
      this.workspaceUsageCount.delete(workspaceId);
      this.scheduleWorkspaceRelease(workspaceId);
      return;
    }

    this.workspaceUsageCount.set(workspaceId, nextCount);
  }

  private markWorkspaceActive(workspaceId: string): void {
    this.clearWorkspaceReleaseTimer(workspaceId);
  }

  private scheduleWorkspaceRelease(workspaceId: string): void {
    if (this.workspaceIdleTtl <= 0) {
      return;
    }

    this.clearWorkspaceReleaseTimer(workspaceId);

    if (!this.workspaceToDataSourceId.has(workspaceId)) {
      return;
    }

    const timer = setTimeout(async () => {
      if ((this.workspaceUsageCount.get(workspaceId) ?? 0) > 0) {
        this.scheduleWorkspaceRelease(workspaceId);
        return;
      }

      try {
        await this.releaseWorkspaceDataSource(workspaceId);
      } catch (error) {
        console.error(
          `Auto-release failed for workspace ${workspaceId}:`,
          error,
        );
      } finally {
        this.clearWorkspaceReleaseTimer(workspaceId);
      }
    }, this.workspaceIdleTtl);

    this.workspaceReleaseTimers.set(workspaceId, timer);
  }

  private clearWorkspaceReleaseTimer(workspaceId: string): void {
    const timer = this.workspaceReleaseTimers.get(workspaceId);
    if (timer) {
      clearTimeout(timer);
      this.workspaceReleaseTimers.delete(workspaceId);
    }
  }
}