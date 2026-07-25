import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('JobOperationResult')
export class JobOperationResultDTO {
  @Field(() => String)
  projectId: string;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => String, { nullable: true })
  error?: string;
}
