import { Field, GraphQLISODateTime, ObjectType } from '@nestjs/graphql';

import { AdminPanelWorkspaceMemberArx } from 'src/engine/core-modules/admin-panel/dtos/admin-panel-workspace-member-arx.output';

@ObjectType()
export class AdminPanelWorkspaceMemberRow {
  @Field()
  workspaceId: string;

  @Field()
  workspaceName: string;

  @Field(() => String, { nullable: true })
  workspaceCompanyName?: string | null;

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

  @Field(() => AdminPanelWorkspaceMemberArx, { nullable: true })
  workspaceMemberArx?: AdminPanelWorkspaceMemberArx | null;
}
