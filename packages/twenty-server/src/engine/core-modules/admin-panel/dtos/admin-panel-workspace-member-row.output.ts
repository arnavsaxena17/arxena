import { Field, GraphQLISODateTime, ObjectType } from '@nestjs/graphql';

import { AdminPanelWorkspaceMemberRecruiterProfile } from 'src/engine/core-modules/admin-panel/dtos/admin-panel-workspace-member-recruiter-profile.output';

@ObjectType()
export class AdminPanelWorkspaceMemberRow {
  @Field()
  workspaceId: string;

  @Field()
  workspaceName: string;

  @Field()
  workspaceSubdomain: string;

  @Field(() => GraphQLISODateTime)
  workspaceCreatedAt: Date;

  @Field()
  userId: string;

  @Field()
  userEmail: string;

  @Field(() => String, { nullable: true })
  userFirstName?: string | null;

  @Field(() => String, { nullable: true })
  userLastName?: string | null;

  @Field(() => GraphQLISODateTime)
  userCreatedAt: Date;

  @Field(() => GraphQLISODateTime)
  membershipCreatedAt: Date;

  @Field(() => AdminPanelWorkspaceMemberRecruiterProfile, { nullable: true })
  recruiterProfile?: AdminPanelWorkspaceMemberRecruiterProfile | null;
}
