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
 * Stores prepaid Arxena credit pools per workspace:
 *   - orgChartCredits: 1 credit per org chart created
 *   - revealCredits: unified email/phone reveal pool
 *   - apiCredits: People API search calls (default 1 credit per search)
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

  @Field()
  @Column({ type: 'int', default: 0 })
  apiCredits: number;
}
