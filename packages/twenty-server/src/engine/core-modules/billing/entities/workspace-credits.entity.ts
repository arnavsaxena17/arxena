/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

/**
 * Razorpay: stores org-chart credits for a workspace (1 credit = 100 person org chart).
 * Incremented on payment.captured for credit-pack purchases.
 */
@Entity({ name: 'workspaceCredits', schema: 'core' })
@ObjectType()
export class WorkspaceCredits {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'uuid', unique: true })
  workspaceId: string;

  @Field()
  @Column({ type: 'int', default: 0 })
  credits: number;
}
