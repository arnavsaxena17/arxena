import { Module, forwardRef } from '@nestjs/common';

import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { OutreachListModule } from 'src/engine/core-modules/outreach-list/outreach-list.module';
import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { ArxenaSearchToolsConfigController } from 'src/engine/core-modules/arxena-tools/controllers/arxena-search-tools-config.controller';
import { ArxenaToolProvider } from 'src/engine/core-modules/arxena-tools/providers/arxena-tool.provider';
import { ArxenaInProcessRestTransportService } from 'src/engine/core-modules/arxena-tools/services/arxena-in-process-rest-transport.service';
import { ArxenaMcpBridgeService } from 'src/engine/core-modules/arxena-tools/services/arxena-mcp-bridge.service';
import { ToolModule } from 'src/engine/core-modules/tool/tool.module';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [
    ApiKeyModule,
    OutreachListModule,
    TokenModule,
    TwentyConfigModule,
    WorkspaceCacheStorageModule,
    // WriteOutreachListRowsToProjectTabService (search + projectId → tab)
    forwardRef(() => ToolModule),
  ],
  controllers: [ArxenaSearchToolsConfigController],
  providers: [
    ArxenaMcpBridgeService,
    ArxenaToolProvider,
    ArxenaInProcessRestTransportService,
  ],
  exports: [ArxenaToolProvider, ArxenaMcpBridgeService],
})
export class ArxenaToolsModule {}
