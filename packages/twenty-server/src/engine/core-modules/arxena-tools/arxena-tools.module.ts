import { Module } from '@nestjs/common';

import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { ArxenaSearchToolsConfigController } from 'src/engine/core-modules/arxena-tools/controllers/arxena-search-tools-config.controller';
import { ArxenaToolProvider } from 'src/engine/core-modules/arxena-tools/providers/arxena-tool.provider';
import { ArxenaMcpBridgeService } from 'src/engine/core-modules/arxena-tools/services/arxena-mcp-bridge.service';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [
    ApiKeyModule,
    TokenModule,
    TwentyConfigModule,
    WorkspaceCacheStorageModule,
  ],
  controllers: [ArxenaSearchToolsConfigController],
  providers: [ArxenaMcpBridgeService, ArxenaToolProvider],
  exports: [ArxenaToolProvider, ArxenaMcpBridgeService],
})
export class ArxenaToolsModule {}
