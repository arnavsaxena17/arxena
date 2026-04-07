// websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { RedisClientModule } from 'src/engine/core-modules/redis-client/redis-client.module';
import { OrgChartProgressBridgeService } from './orgchart-progress-bridge.service';
import { WebSocketController } from './websocket.controller';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';

@Module({
  imports: [UnipilePoolModule, RedisClientModule],
  controllers: [WebSocketController],
  providers: [
    WebSocketGateway,
    WebSocketService,
    StaticGraphQLService,
    OrgChartProgressBridgeService,
  ],
  exports: [WebSocketGateway, WebSocketService],
})
export class WebSocketModule {}