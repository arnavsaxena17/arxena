import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('WhatsAppSessionDetail')
export class WhatsAppSessionDetail {
  @Field()
  recruiterId: string;

  @Field()
  lastActivity: string;

  @Field()
  connectionCount: number;

  @Field()
  isActive: boolean;

  @Field()
  uptime: number;

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

@ObjectType('WhatsAppSessions')
export class WhatsAppSessions {
  @Field(() => [WhatsAppSessionDetail])
  sessions: WhatsAppSessionDetail[];
}
