// websocket/websocket.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { WebSocketService } from './websocket.service';

@Controller('api/websocket')
export class WebSocketController {
  constructor(private readonly webSocketService: WebSocketService) {}

  @Post('broadcast')
  broadcastMessage(@Body() payload: any) {
    // Send a message to all connected clients
    this.webSocketService.sendToAll('message', payload);
    return {
      success: true,
      message: 'Message broadcasted to all connected clients',
      payload,
    };
  }

  @Post('user/:userId')
  sendToUser(@Param('userId') userId: string, @Body() payload: any) {
    // Send a message to a specific user
    this.webSocketService.sendToUser(userId, 'message', payload);
    return {
      success: true,
      message: `Message sent to user: ${userId}`,
      payload,
    };
  }

  @Post('room/:roomId')
  sendToRoom(@Param('roomId') roomId: string, @Body() payload: any) {
    // Send a message to a specific room
    this.webSocketService.sendToRoom(roomId, 'message', payload);
    return {
      success: true,
      message: `Message sent to room: ${roomId}`,
      payload,
    };
  }

  @Post('custom-event')
  sendCustomEvent(@Body() request: { event: string; data: any }) {
    // Send a custom event
    this.webSocketService.sendToAll(request.event, request.data);
    return {
      success: true,
      message: `Sent custom event: ${request.event}`,
      payload: request.data,
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      connections: 'active', // You could enhance this with actual connection stats
      timestamp: new Date().toISOString(),
    };
  }
}