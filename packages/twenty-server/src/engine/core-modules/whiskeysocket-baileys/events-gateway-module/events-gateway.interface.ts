import { Server } from 'socket.io';

export interface IEventsGateway {
  emitEventTo(event: string, data: any, socketClientId: string, recruiterName?: string): void;
  getServer(): Server;
} 