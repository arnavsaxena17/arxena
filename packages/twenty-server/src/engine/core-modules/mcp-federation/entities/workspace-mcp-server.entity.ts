import {
  Field,
  ObjectType,
  registerEnumType,
  HideField,
} from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

export enum WorkspaceMcpToolMode {
  ALL = 'all',
  ALLOWLIST = 'allowlist',
}

registerEnumType(WorkspaceMcpToolMode, { name: 'WorkspaceMcpToolMode' });

@Entity({ name: 'workspaceMcpServer', schema: 'core' })
@Unique('UQ_WORKSPACE_MCP_SERVER_WORKSPACE_SLUG', ['workspaceId', 'slug'])
@Index('IDX_WORKSPACE_MCP_SERVER_WORKSPACE_ID', ['workspaceId'])
@ObjectType('WorkspaceMcpServer')
export class WorkspaceMcpServerEntity {
  @Field(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'varchar' })
  label: string;

  @Field()
  @Column({ type: 'varchar' })
  slug: string;

  @Field()
  @Column({ type: 'varchar', default: 'streamable-http' })
  transport: string;

  @Field()
  @Column({ type: 'varchar' })
  url: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  authHeaderName?: string;

  @HideField()
  @Column({ type: 'text', nullable: true })
  authTokenEncrypted?: string;

  @Field()
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Field(() => WorkspaceMcpToolMode)
  @Column({
    type: 'enum',
    enum: WorkspaceMcpToolMode,
    default: WorkspaceMcpToolMode.ALL,
  })
  toolMode: WorkspaceMcpToolMode;

  @Field(() => [String])
  @Column({ type: 'jsonb', default: [] })
  toolAllowlist: string[];

  @HideField()
  @Column({ type: 'jsonb', nullable: true })
  cachedToolsJson?: unknown;

  @Field({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  catalogHash?: string;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastSyncAt?: Date;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  lastSyncError?: string;

  @Field()
  @Column({ type: 'int', default: 30000 })
  timeoutMs: number;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ nullable: false, type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Relation<WorkspaceEntity>;

  @Field()
  hasAuthToken?: boolean;
}
