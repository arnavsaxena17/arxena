import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AdminGrantOrgChartToWorkspaceInput {
  @Field()
  workspaceId: string;

  @Field()
  companyId: string;

  @Field({ nullable: true })
  companyName?: string;

  @Field({ nullable: true, defaultValue: true })
  createCrmRow?: boolean;

  @Field({ nullable: true, defaultValue: false })
  createProject?: boolean;

  @Field({ nullable: true, defaultValue: false })
  chargeCredits?: boolean;
}
