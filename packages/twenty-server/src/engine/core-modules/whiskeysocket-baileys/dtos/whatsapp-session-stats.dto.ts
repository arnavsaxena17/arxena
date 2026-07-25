import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('WhatsAppSessionStats')
export class WhatsAppSessionStats {
  @Field()
  totalSessions: number;

  @Field()
  activeSessions: number;

  @Field()
  inactiveSessions: number;

  @Field()
  registeredSessions: number;

  @Field()
  totalMemoryUsageMB: number;

  @Field()
  averageMemoryPerSessionMB: number;

  @Field()
  memoryEfficiency: number;
}
