export interface IEventsGateway {
  emitEventTo(event: string, data: any, socketClientId: string): void;
} 