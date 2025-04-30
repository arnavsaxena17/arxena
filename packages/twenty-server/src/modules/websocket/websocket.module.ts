// websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { WebSocketController } from './websocket.controller';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';

@Module({
  controllers: [WebSocketController],
  providers: [WebSocketGateway, WebSocketService],
  exports: [WebSocketService],
})
export class WebSocketModule {}