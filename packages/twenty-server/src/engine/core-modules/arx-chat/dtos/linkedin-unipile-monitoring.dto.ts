import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('LinkedInUnipileSessionInfo')
export class LinkedInUnipileSessionInfo {
  @Field()
  total: number;

  @Field()
  active: number;

  @Field()
  inactive: number;
}

@ObjectType('LinkedInUnipileSessionMetric')
export class LinkedInUnipileSessionMetric {
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
  linkedinConnectionStatus: string;
}

@ObjectType('LinkedInUnipileHealthStatus')
export class LinkedInUnipileHealthStatus {
  @Field()
  status: string;

  @Field()
  timestamp: string;

  @Field(() => LinkedInUnipileSessionInfo)
  sessions: LinkedInUnipileSessionInfo;

  @Field(() => [LinkedInUnipileSessionMetric])
  metrics: LinkedInUnipileSessionMetric[];
}

@ObjectType('LinkedInUnipileSessionStats')
export class LinkedInUnipileSessionStats {
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
