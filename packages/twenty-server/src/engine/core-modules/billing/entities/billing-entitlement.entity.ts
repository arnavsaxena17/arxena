/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { BillingEntitlementKey } from 'src/engine/core-modules/billing/enums/billing-entitlement-key.enum';

@Entity({ name: 'billingEntitlement', schema: 'core' })
@ObjectType()
@Unique('IndexOnFeatureKeyAndWorkspaceIdUnique', ['key', 'workspaceId'])
export class BillingEntitlement {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String)
  @Column({ nullable: false, type: 'text' })
  key: BillingEntitlementKey;

  @Field()
  @Column({ nullable: false, type: 'uuid' })
  workspaceId: string;

  @Column({ nullable: true, type: 'character varying' })
  stripeCustomerId: string | null;

  @Field()
  @Column({ nullable: false })
  value: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  deletedAt?: Date;
}
