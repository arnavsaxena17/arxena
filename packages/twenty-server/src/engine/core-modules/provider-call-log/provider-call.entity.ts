import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { type ProviderCallCacheStatus } from 'src/engine/core-modules/provider-call-log/types/provider-call-cache-status.type';

// One row per request a tool sends (or would have sent) to an outside data
// source, tagged with the chat turn that caused it. The response itself stays
// in the provider query cache (Redis + S3); responseLocation points at it.
// No workspace foreign key: a log row must never fail a provider call, and it
// is written for calls made outside any workspace too.
@Entity({ name: 'providerCall', schema: 'core' })
@Index('IDX_PROVIDER_CALL_THREAD_ID_CREATED_AT', ['threadId', 'createdAt'])
@Index('IDX_PROVIDER_CALL_WORKSPACE_ID_CREATED_AT', [
  'workspaceId',
  'createdAt',
])
@Index('IDX_PROVIDER_CALL_RUN_ID', ['runId'])
@Index('IDX_PROVIDER_CALL_CACHE_KEY', ['cacheKey'])
export class ProviderCallEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'uuid', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  threadId: string | null;

  @Column({ type: 'uuid', nullable: true })
  turnId: string | null;

  @Column({ type: 'varchar', nullable: true })
  toolCallId: string | null;

  @Column({ type: 'varchar', nullable: true })
  toolName: string | null;

  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  // A background run (find_people_by_company chunks) that made the call
  @Column({ type: 'varchar', nullable: true })
  runId: string | null;

  // The company or person the request was about
  @Column({ type: 'varchar', nullable: true })
  subject: string | null;

  // The step of the tool that sent it (bright_data, harvest, serp_sources...)
  @Column({ type: 'varchar', nullable: true })
  stage: string | null;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ type: 'varchar' })
  operation: string;

  @Column({ type: 'jsonb', nullable: true })
  request: object | null;

  @Column({ type: 'varchar', nullable: true })
  cacheKey: string | null;

  @Column({ type: 'varchar' })
  cacheStatus: ProviderCallCacheStatus;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'integer', nullable: true })
  durationMs: number | null;

  @Column({ type: 'integer', nullable: true })
  resultCount: number | null;

  @Column({ type: 'integer', nullable: true })
  responseBytes: number | null;

  // File storage path of the response: the provider query cache file, or
  // the copy written for a source that is not cached
  @Column({ type: 'varchar', nullable: true })
  responseLocation: string | null;
}
