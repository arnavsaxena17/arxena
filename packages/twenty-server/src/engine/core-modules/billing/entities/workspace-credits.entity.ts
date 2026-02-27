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
 * Stores credits for a workspace: org chart credits and contact credits (email/phone).
 * Org chart: 1 credit = 1 org chart of up to 100 employees. Larger charts consume more:
 * credits = Math.ceil(employeeCount / 100). Incremented on payment.captured for credit-pack purchases.
 * Contact credits: 1 credit per email fetch, 1 credit per phone fetch.
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
  emailContactCredits: number;

  @Field()
  @Column({ type: 'int', default: 0 })
  phoneContactCredits: number;
}
