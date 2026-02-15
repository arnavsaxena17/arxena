/* @license Enterprise */

import { ObjectType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    Relation,
    UpdateDateColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { BillingSubscription } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';

@Entity({ name: 'billingCustomer', schema: 'core' })
@ObjectType()
export class BillingCustomer {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, type: 'timestamptz' })
  deletedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ nullable: false, type: 'uuid', unique: true })
  workspaceId: string;

  @Column({ nullable: true, unique: true, type: 'character varying' })
  stripeCustomerId: string | null;

  @Column({ nullable: true, unique: true, type: 'character varying' })
  razorpayCustomerId: string | null;

  @OneToMany(
    () => BillingSubscription,
    (billingSubscription) => billingSubscription.billingCustomer,
  )
  billingSubscriptions: Relation<BillingSubscription[]>;
}
