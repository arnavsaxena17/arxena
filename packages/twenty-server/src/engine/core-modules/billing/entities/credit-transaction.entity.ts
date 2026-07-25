/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';
import { IDField } from '@ptc-org/nestjs-query-graphql';
import GraphQLJSON from 'graphql-type-json';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

/**
 * Audit trail for credit transactions (debits and credits).
 * Active tags for the two-pool model are
 * `'org_chart' | 'email_reveal' | 'phone_reveal' | 'reveal_top_up'`.
 * Legacy `'email_contact' | 'phone_contact'` rows from the pre-unification
 * era remain valid for historical reads.
 */
@Entity({ name: 'creditTransactions', schema: 'core' })
@Index(['workspaceId', 'createdAt'])
@ObjectType()
export class CreditTransaction {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Field()
  @Column({ type: 'varchar', length: 20 })
  type: 'debit' | 'credit';

  @Field()
  @Column({ type: 'varchar', length: 30 })
  creditType:
    | 'org_chart'
    | 'email_reveal'
    | 'phone_reveal'
    | 'reveal_top_up'
    | 'email_contact'
    | 'phone_contact';

  @Field()
  @Column({ type: 'int' })
  amount: number;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
