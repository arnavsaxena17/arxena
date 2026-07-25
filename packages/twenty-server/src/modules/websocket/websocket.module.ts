// websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { RedisClientModule } from 'src/engine/core-modules/redis-client/redis-client.module';
import { OrgChartProgressBridgeService } from './orgchart-progress-bridge.service';
import { WebSocketUserBridgeService } from './websocket-user-bridge.service';
import { WebSocketController } from './websocket.controller';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';

@Module({
  imports: [RedisClientModule],
  controllers: [WebSocketController],
  providers: [
    WebSocketGateway,
    WebSocketService,
    OrgChartProgressBridgeService,
    WebSocketUserBridgeService,
  ],
  exports: [WebSocketGateway, WebSocketService],
})
export class WebSocketModule {}
