import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class RenameAdminPublishedOrgChartSlugInput {
  @Field()
  publishSlug: string;

  @Field()
  newPublishSlug: string;
}
