import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminLinkedinParameterCacheEntry {
  @Field()
  cacheKey: string;

  @Field()
  parameterType: string;

  @Field()
  searchTerm: string;

  @Field(() => String, { nullable: true })
  linkedinId?: string | null;

  @Field(() => String, { nullable: true })
  linkedinTitle?: string | null;

  @Field()
  notFound: boolean;
}
