import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { AuthModule } from '../auth/auth.module';
import { ExtensionBridgeController } from './extension-bridge.controller';
import { ExtensionBridgeService } from './extension-bridge.service';
import { ExtensionLinkedinCookieFetchService } from './extension-linkedin-cookie-fetch.service';
import { ExtensionPresenceController } from './extension-presence.controller';
import { ExtensionPresenceService } from './extension-presence.service';
import { ExtensionSocketGateway } from './extension-socket.gateway';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([WorkspaceEntity])],
  controllers: [ExtensionBridgeController, ExtensionPresenceController],
  providers: [
    ExtensionSocketGateway,
    ExtensionBridgeService,
    ExtensionLinkedinCookieFetchService,
    ExtensionPresenceService,
    WorkspaceCacheStorageService,
  ],
  exports: [
    ExtensionSocketGateway,
    ExtensionBridgeService,
    ExtensionLinkedinCookieFetchService,
  ],
})
export class ExtensionBridgeModule {}
