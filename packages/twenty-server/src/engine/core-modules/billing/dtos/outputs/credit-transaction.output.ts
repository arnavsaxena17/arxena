/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class CreditTransactionOutput {
  @Field()
  id: string;

  @Field()
  type: string;

  @Field()
  creditType: string;

  @Field()
  amount: number;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata: Record<string, unknown> | null;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class CreditTransactionsOutput {
  @Field(() => [CreditTransactionOutput])
  items: CreditTransactionOutput[];

  @Field({ nullable: true })
  nextCursor?: string;
}
