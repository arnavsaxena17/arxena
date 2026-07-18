import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminConnectMemberLinkedinUnipileOutput {
  @Field(() => Boolean)
  attempted: boolean;

  @Field(() => Boolean)
  connected: boolean;

  @Field(() => Boolean)
  keepConnected: boolean;

  @Field(() => Boolean)
  hasLiAt: boolean;

  @Field(() => Boolean)
  hasLiA: boolean;

  @Field(() => String, { nullable: true })
  lastSyncedAt?: string | null;

  @Field(() => String, { nullable: true })
  lastValidatedAt?: string | null;

  @Field(() => String, { nullable: true })
  message?: string | null;

  @Field(() => String, { nullable: true })
  errorCode?: string | null;

  @Field(() => Boolean)
  reconnectAttempted: boolean;

  @Field(() => Boolean)
  reconnectSucceeded: boolean;

  @Field(() => String, { nullable: true })
  accountId?: string | null;

  @Field(() => String, { nullable: true })
  accountStatus?: string | null;
}
