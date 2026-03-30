import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Snapshot of workspaceMemberProfile for the looked-up user in a workspace
 * (same source as RecruiterProfileService / findWorkspaceMemberProfiles).
 */
@ObjectType()
export class AdminPanelWorkspaceMemberRecruiterProfile {
  @Field(() => String, { nullable: true })
  workspaceMemberId?: string | null;

  @Field(() => String, { nullable: true })
  profileId?: string | null;

  @Field(() => String, { nullable: true })
  phoneNumber?: string | null;

  @Field(() => String, { nullable: true })
  linkedinUrl?: string | null;

  @Field(() => String, { nullable: true })
  linkedinUnipileAccountId?: string | null;

  @Field(() => String, { nullable: true })
  whatsappUnipileAccountId?: string | null;

  @Field(() => Boolean, { nullable: true })
  keepLinkedinConnected?: boolean | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  jobTitle?: string | null;

  @Field(() => String, { nullable: true })
  companyName?: string | null;

  @Field(() => String, { nullable: true })
  companyDescription?: string | null;

  @Field(() => String, { nullable: true })
  typeWorkspaceMember?: string | null;

  @Field(() => String, { nullable: true })
  chromeExtensionId?: string | null;
}
