import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.25.0', 1793432153731)
export class CreateProviderCallCoreTableFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."providerCall" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "workspaceId" uuid,
        "threadId" uuid,
        "turnId" uuid,
        "toolCallId" character varying,
        "toolName" character varying,
        "projectId" uuid,
        "runId" character varying,
        "subject" character varying,
        "stage" character varying,
        "provider" character varying NOT NULL,
        "operation" character varying NOT NULL,
        "request" jsonb,
        "cacheKey" character varying,
        "cacheStatus" character varying NOT NULL,
        "success" boolean NOT NULL DEFAULT true,
        "errorMessage" text,
        "durationMs" integer,
        "resultCount" integer,
        "responseBytes" integer,
        "responseLocation" character varying,
        CONSTRAINT "PK_b321c7b3e56665e4a2e3a463971" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PROVIDER_CALL_THREAD_ID_CREATED_AT" ON "core"."providerCall" ("threadId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PROVIDER_CALL_WORKSPACE_ID_CREATED_AT" ON "core"."providerCall" ("workspaceId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PROVIDER_CALL_RUN_ID" ON "core"."providerCall" ("runId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PROVIDER_CALL_CACHE_KEY" ON "core"."providerCall" ("cacheKey")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."providerCall"`);
  }
}
