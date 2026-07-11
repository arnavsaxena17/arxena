import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class RebuildAdminPublishedOrgChartInput {
  @Field()
  publishSlug: string;
}
