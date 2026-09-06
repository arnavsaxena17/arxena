import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminGrantOrgChartToWorkspaceOutput {
  @Field()
  workspaceId: string;

  @Field()
  companyId: string;

  @Field()
  orgChartS3RelativePath: string;

  @Field()
  alreadyHadAccess: boolean;

  @Field()
  accessGranted: boolean;

  @Field()
  chargedCredits: boolean;

  @Field({ nullable: true })
  orgChartRecordId?: string;

  @Field({ nullable: true })
  projectName?: string;

  @Field({ nullable: true })
  projectCreated?: boolean;

  @Field({ nullable: true })
  itemCount?: number;

  @Field({ nullable: true })
  companyName?: string;
}

@ObjectType()
export class AdminOrgChartArtifactOutput {
  @Field()
  companyId: string;

  @Field()
  orgChartS3RelativePath: string;

  @Field()
  hasOrgChartInS3: boolean;

  @Field({ nullable: true })
  companyName?: string;

  @Field({ nullable: true })
  itemCount?: number;
}
