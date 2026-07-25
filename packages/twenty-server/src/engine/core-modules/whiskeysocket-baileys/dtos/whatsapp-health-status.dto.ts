import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('WhatsAppSessionInfo')
export class WhatsAppSessionInfo {
  @Field()
  total: number;

  @Field()
  active: number;

  @Field()
  inactive: number;
}

@ObjectType('WhatsAppSessionMetric')
export class WhatsAppSessionMetric {
  @Field()
  recruiterId: string;

  @Field()
  lastActivity: string;

  @Field()
  connectionCount: number;

  @Field()
  isActive: boolean;

  @Field()
  memoryUsageMB: number;

  @Field()
  isRegistered: boolean;

  @Field()
  hasAuthFiles: boolean;

  @Field()
  hasWebSocketConnection: boolean;

  @Field()
  whatsappConnectionStatus: string;
}

@ObjectType('WhatsAppHealthStatus')
export class WhatsAppHealthStatus {
  @Field()
  status: string;

  @Field()
  timestamp: string;

  @Field(() => WhatsAppSessionInfo)
  sessions: WhatsAppSessionInfo;

  @Field(() => [WhatsAppSessionMetric])
  metrics: WhatsAppSessionMetric[];
}
