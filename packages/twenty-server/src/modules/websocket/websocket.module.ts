// websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WebSocketController } from './websocket.controller';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';

@Module({
  controllers: [WebSocketController],
  providers: [WebSocketGateway, WebSocketService, StaticGraphQLService],
  exports: [WebSocketGateway, WebSocketService],
})
export class WebSocketModule {}