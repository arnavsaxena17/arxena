import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateAdminPublishedOrgChartInput {
  @Field()
  publishSlug: string;

  @Field({ nullable: true })
  companyId?: string;

  @Field({ nullable: true })
  companyName?: string;

  @Field({ nullable: true })
  companyLinkedinUrl?: string;

  @Field({ nullable: true })
  companyWebsite?: string;

  @Field({ nullable: true })
  industry?: string;

  @Field({ nullable: true })
  country?: string;
}
