import { Module } from '@nestjs/common';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { ArxenaToolProvider } from 'src/engine/core-modules/arxena-tools/providers/arxena-tool.provider';
import { ArxenaMcpBridgeService } from 'src/engine/core-modules/arxena-tools/services/arxena-mcp-bridge.service';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';

@Module({
  imports: [TokenModule, TwentyConfigModule],
  providers: [ArxenaMcpBridgeService, ArxenaToolProvider],
  exports: [ArxenaToolProvider, ArxenaMcpBridgeService],
})
export class ArxenaToolsModule {}
