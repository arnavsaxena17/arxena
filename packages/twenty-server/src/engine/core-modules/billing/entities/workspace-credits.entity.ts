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
 * Stores credits for a workspace using two distinct pools:
 *   - orgChartCredits: 1 credit per org chart created (regardless of employee count).
 *     Funded on payment.captured by the number of `maps` in the purchased tier.
 *   - revealCredits: unified pool covering both email and phone reveals. Default
 *     spend rates (1 credit/email, 5 credits/phone) come from getRevealCost(kind)
 *     in twenty-shared so operators can retune them via env vars at runtime.
 *     Funded on payment.captured by the tier's `credits` field.
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
  orgChartCredits: number;

  @Field()
  @Column({ type: 'int', default: 0 })
  revealCredits: number;
}
