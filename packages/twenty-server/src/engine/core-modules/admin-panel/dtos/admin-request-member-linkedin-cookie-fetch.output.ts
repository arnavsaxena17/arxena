import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminRequestMemberLinkedinCookieFetchOutput {
  @Field(() => String)
  status: string;

  @Field(() => String)
  deadlineAt: string;
}
