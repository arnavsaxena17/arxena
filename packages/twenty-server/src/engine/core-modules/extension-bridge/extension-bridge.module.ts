import { Module } from '@nestjs/common';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { AuthModule } from '../auth/auth.module';
import { ExtensionBridgeController } from './extension-bridge.controller';
import { ExtensionBridgeService } from './extension-bridge.service';
import { ExtensionSocketGateway } from './extension-socket.gateway';

@Module({
  imports: [AuthModule],
  controllers: [ExtensionBridgeController],
  providers: [ExtensionSocketGateway, ExtensionBridgeService,WorkspaceCacheStorageService],
  exports: [ExtensionSocketGateway, ExtensionBridgeService],
})
export class ExtensionBridgeModule {}
