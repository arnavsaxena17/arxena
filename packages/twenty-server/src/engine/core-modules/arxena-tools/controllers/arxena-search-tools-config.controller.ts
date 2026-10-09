import { Controller, Get, UseGuards } from '@nestjs/common';

import {
  type SearchToolsConfig,
  resolveSearchToolsConfig,
} from 'src/engine/core-modules/arxena-tools/utils/search-tools-config.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

// The MCP process has its own env, so it reads provider flags from here
// to keep one source of truth for which search providers are enabled.
@Controller('arxena-tools')
@UseGuards(JwtAuthGuard)
export class ArxenaSearchToolsConfigController {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  @Get('search-tools-config')
  getSearchToolsConfig(): SearchToolsConfig {
    return resolveSearchToolsConfig(this.twentyConfigService);
  }
}
