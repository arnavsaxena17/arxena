import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceMcpServerEntity } from 'src/engine/core-modules/mcp-federation/entities/workspace-mcp-server.entity';
import { DownstreamMcpToolProvider } from 'src/engine/core-modules/mcp-federation/providers/downstream-mcp-tool.provider';
import { DownstreamMcpConnectionManager } from 'src/engine/core-modules/mcp-federation/services/downstream-mcp-connection.manager';
import { WorkspaceMcpServerService } from 'src/engine/core-modules/mcp-federation/services/workspace-mcp-server.service';
import { WorkspaceMcpServerResolver } from 'src/engine/core-modules/mcp-federation/workspace-mcp-server.resolver';
import { SecretEncryptionModule } from 'src/engine/core-modules/secret-encryption/secret-encryption.module';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceMcpServerEntity]),
    SecretEncryptionModule,
    PermissionsModule,
  ],
  providers: [
    DownstreamMcpConnectionManager,
    WorkspaceMcpServerService,
    DownstreamMcpToolProvider,
    WorkspaceMcpServerResolver,
  ],
  exports: [
    DownstreamMcpToolProvider,
    WorkspaceMcpServerService,
    DownstreamMcpConnectionManager,
  ],
})
export class McpFederationModule {}
