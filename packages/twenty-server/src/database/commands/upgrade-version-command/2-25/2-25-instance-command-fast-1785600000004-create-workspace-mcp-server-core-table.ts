import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.25.0', 1785600000004)
export class CreateWorkspaceMcpServerCoreTableFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "core"."workspaceMcpServer_toolMode_enum" AS ENUM ('all', 'allowlist'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."workspaceMcpServer" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "transport" character varying NOT NULL DEFAULT 'streamable-http',
        "url" character varying NOT NULL,
        "authHeaderName" character varying,
        "authTokenEncrypted" text,
        "enabled" boolean NOT NULL DEFAULT true,
        "toolMode" "core"."workspaceMcpServer_toolMode_enum" NOT NULL DEFAULT 'all',
        "toolAllowlist" jsonb NOT NULL DEFAULT '[]',
        "cachedToolsJson" jsonb,
        "catalogHash" character varying,
        "lastSyncAt" TIMESTAMP WITH TIME ZONE,
        "lastSyncError" text,
        "timeoutMs" integer NOT NULL DEFAULT 30000,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "workspaceId" uuid NOT NULL,
        CONSTRAINT "PK_workspaceMcpServer_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_WORKSPACE_MCP_SERVER_WORKSPACE_SLUG" UNIQUE ("workspaceId", "slug"),
        CONSTRAINT "FK_workspaceMcpServer_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_WORKSPACE_MCP_SERVER_WORKSPACE_ID"
        ON "core"."workspaceMcpServer" ("workspaceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."workspaceMcpServer"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "core"."workspaceMcpServer_toolMode_enum"`,
    );
  }
}
