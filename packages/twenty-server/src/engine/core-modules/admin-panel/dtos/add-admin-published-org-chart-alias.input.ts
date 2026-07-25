import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AddAdminPublishedOrgChartAliasInput {
  @Field()
  sourcePublishSlug: string;

  @Field()
  newPublishSlug: string;
}
