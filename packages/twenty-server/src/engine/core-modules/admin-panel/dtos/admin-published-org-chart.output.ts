import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminPublishedOrgChart {
  @Field()
  publishSlug: string;

  @Field()
  companyId: string;

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

  @Field({ nullable: true })
  countOrg?: number;

  @Field()
  publishedAt: string;

  @Field()
  workspaceId: string;

  @Field()
  hasOrgChartInS3: boolean;

  @Field({ nullable: true })
  s3RelativePath?: string;
}
