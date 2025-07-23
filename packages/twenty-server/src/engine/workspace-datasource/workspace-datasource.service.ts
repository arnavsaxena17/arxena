import { Injectable } from '@nestjs/common';

import { DataSource, EntityManager } from 'typeorm';

import { TypeORMService } from 'src/database/typeorm/typeorm.service';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';

@Injectable()
export class WorkspaceDataSourceService {
  private dataSourceCache: Map<string, DataSource> = new Map();

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
    const { dataSource } =
      await this.connectedToWorkspaceDataSourceAndReturnMetadata(workspaceId);

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

  /**
   *
   * Create a new DB schema for a workspace
   *
   * @param workspaceId
   * @returns
   */
  public async createWorkspaceDBSchema(workspaceId: string): Promise<string> {
    const schemaName = this.getSchemaName(workspaceId);
    console.log("This is the schemaName", schemaName)
    return await this.typeormService.createSchema(schemaName);
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

  /**
   * Force pool initialization by creating multiple connections
   */
  private async forcePoolInitialization(dataSource: DataSource): Promise<void> {
    try {
      console.log('[Perf] === Forcing Pool Initialization ===');
      
      // Get initial pool state
      this.getPoolInfo(dataSource);
      
      // Execute multiple queries in parallel to force pool to create minimum connections
      const minConnections = 10;
      const queries = Array(minConnections).fill(null).map((_, i) => 
        dataSource.query(`SELECT ${i} as test_connection`)
      );
      
      // console.log(`[Perf] Executing ${minConnections} parallel queries to force pool initialization...`);
      const startTime = performance.now();
      await Promise.all(queries);
      const totalTime = performance.now() - startTime;
      // console.log(`[Perf] All queries completed in: ${totalTime.toFixed(2)} ms`);
      
      // Get pool state after forcing initialization
      // console.log('[Perf] Pool state after forced initialization:');
      this.getPoolInfo(dataSource);
      
      // console.log('[Perf] === End Pool Initialization ===');
    } catch (error) {
      // console.log('[Perf] Error forcing pool initialization:', error.message);
    }
  }

  /**
   * Test pool behavior by executing a simple query
   */
  private async testPoolBehavior(dataSource: DataSource): Promise<void> {
    try {
      // console.log('[Perf] === Testing Pool Behavior ===');
      
      // Get initial pool state
      this.getPoolInfo(dataSource);
      
      // Execute a simple query to trigger pool usage
      // console.log('[Perf] Executing test query to trigger pool...');
      const startTime = performance.now();
      await dataSource.query('SELECT 1 as test');
      const queryTime = performance.now() - startTime;
      // console.log('[Perf] Test query completed in:', queryTime.toFixed(2), 'ms');
      
      // Get pool state after query
      // console.log('[Perf] Pool state after test query:');
      this.getPoolInfo(dataSource);
      
      // console.log('[Perf] === End Pool Behavior Test ===');
    } catch (error) {
      // console.log('[Perf] Error testing pool behavior:', error.message);
    }
  }

    /**
   * Get detailed connection pool information for debugging
   */
  private getPoolInfo(dataSource: DataSource): void {
    try {
      const driver = (dataSource as any).driver;
      if (!driver) {
        // console.log('[Perf] No driver found in DataSource');
        return;
      }

      // console.log('[Perf] === Connection Pool Diagnostics ===');
      
      // Log driver type
      // console.log('[Perf] Driver type:', driver.constructor.name);
      
      // Log the database URL to check for connection limits
      const dbUrl = driver.options?.url || 'unknown';
      // console.log('[Perf] Database URL:', dbUrl);
      
      // Check if URL has connection limit parameters
      if (dbUrl.includes('connection_limit') || dbUrl.includes('pool_size')) {
        // console.log('[Perf] WARNING: Database URL contains connection limit parameters!');
        // console.log('[Perf] This may override TypeORM pool settings.');
      }
      
      // Log pool configuration
      const poolConfig = driver.options?.extra;
      if (poolConfig) {
        // console.log('[Perf] Pool configuration:');
        // console.log('[Perf]   - Max connections:', poolConfig.max);
        // console.log('[Perf]   - Min connections:', poolConfig.min);
        // console.log('[Perf]   - Idle timeout:', poolConfig.idle, 'ms');
        // console.log('[Perf]   - Acquire timeout:', poolConfig.acquire, 'ms');
        // console.log('[Perf]   - Evict interval:', poolConfig.evict, 'ms');
      }

      // Log actual pool status
      const pool = driver.master;
      if (pool) {
        // console.log('[Perf] Pool status:');
        // console.log('[Perf]   - Pool size:', pool._size || 'unknown');
        // console.log('[Perf]   - Available connections:', pool._clients?.length || 'unknown');
        // console.log('[Perf]   - Pool type:', pool.constructor.name);
        
        // Check if pool is properly initialized
        if (pool._clients && Array.isArray(pool._clients)) {
          // console.log('[Perf]   - Connection array length:', pool._clients.length);
          // console.log('[Perf]   - Connection states:', pool._clients.map((client: any) => client?.processID || 'unknown'));
        }
        
        // Additional pool diagnostics
        // console.log('[Perf]   - Pool totalCount:', pool.totalCount || 'unknown');
        // console.log('[Perf]   - Pool idleCount:', pool.idleCount || 'unknown');
        // console.log('[Perf]   - Pool waitingCount:', pool.waitingCount || 'unknown');
        
        // Check if this is a node-postgres pool
        if (pool.constructor.name.includes('Pool')) {
          // console.log('[Perf]   - This appears to be a node-postgres Pool');
          // Try to access node-postgres specific properties
          // console.log('[Perf]   - Pool options:', pool.options || 'unknown');
        }
      } else {
        // console.log('[Perf] No pool found in driver');
      }
      
      // console.log('[Perf] === End Pool Diagnostics ===');
    } catch (error) {
      // console.log('[Perf] Error getting pool info:', error.message);
    }
  }

  public async executeRawQuery(
    query: string,
    parameters: any[] = [],
    workspaceId: string,
    transactionManager?: EntityManager,
  ): Promise<any> {
    try {
      console.log('[Perf] Executing raw query for workspace:', workspaceId);
      if (transactionManager) {
        console.log('[Perf] Executing raw query with transaction manager');
        return await transactionManager.query(query, parameters);
      }
      console.log('[Perf] Executing raw query without transaction manager');
      // Check cache first
      if (this.dataSourceCache.has(workspaceId)) {
        console.log('[Perf] Reusing cached DataSource for workspace:', workspaceId);
        const cachedDataSource = this.dataSourceCache.get(workspaceId);
        if (cachedDataSource) {
          console.log('[Perf] cachedDataSource found - Reusing cached DataSource for workspace:', workspaceId);
          // Add detailed connection pool diagnostics
          this.getPoolInfo(cachedDataSource);
          return await cachedDataSource.query(query, parameters);
        }
      }
      
      // If not in cache, create and cache it
      console.log('[Perf] Creating new DataSource for workspace:', workspaceId);
      const workspaceDataSource = await this.connectToWorkspaceDataSource(workspaceId);
      this.dataSourceCache.set(workspaceId, workspaceDataSource);
      
      // Add pool diagnostics and force pool initialization for new DataSource
      this.getPoolInfo(workspaceDataSource);
      await this.forcePoolInitialization(workspaceDataSource);
      
      return await workspaceDataSource.query(query, parameters);
    } catch (error) {
      throw new Error(
        `Error executing raw query for workspace ${workspaceId}: ${error.message}`,
      );
    }
  }
}
