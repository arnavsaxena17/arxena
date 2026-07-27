import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

// Auto-generated TypeORM sync dump also tried to recreate ARX billing / MCP /
// org-chart objects. On arxanalytics those already exist from earlier 2.25
// commands, so only create the net-new tables here.
@RegisteredInstanceCommand('2.25.0', 1785138251592)
export class AddAiProviderCredentialFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."aiProviderCredential" (
        "workspaceId" uuid NOT NULL,
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "providerName" character varying(255) NOT NULL,
        "encryptedApiKey" text NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "IDX_AI_PROVIDER_CREDENTIAL_WORKSPACE_ID_PROVIDER_NAME_UNIQUE"
          UNIQUE ("workspaceId", "providerName"),
        CONSTRAINT "CHK_aiProviderCredential_encryptedApiKey_encrypted"
          CHECK ("encryptedApiKey" = '' OR "encryptedApiKey" LIKE 'enc:v2:%'),
        CONSTRAINT "PK_0deb4fd44454b1597863cea1f92" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_AI_PROVIDER_CREDENTIAL_WORKSPACE_ID"
       ON "core"."aiProviderCredential" ("workspaceId")`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "core"."aiProviderCredential"
          ADD CONSTRAINT "FK_72a8e71a937eec71061081a8dcc"
          FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN null; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "core"."privacy_consent_event_consenttype_enum"
          AS ENUM('cookie_banner', 'terms_at_signup');
      EXCEPTION WHEN duplicate_object THEN null; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "core"."privacy_consent_event_action_enum"
          AS ENUM('accept_all', 'reject_all', 'custom', 'withdraw');
      EXCEPTION WHEN duplicate_object THEN null; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "core"."privacy_consent_event_source_enum"
          AS ENUM('website', 'app');
      EXCEPTION WHEN duplicate_object THEN null; END $$
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."privacy_consent_event" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "visitorId" uuid NOT NULL,
        "consentType" "core"."privacy_consent_event_consenttype_enum" NOT NULL,
        "policyVersion" character varying(32) NOT NULL,
        "action" "core"."privacy_consent_event_action_enum" NOT NULL,
        "categories" jsonb NOT NULL,
        "source" "core"."privacy_consent_event_source_enum" NOT NULL,
        "userAgent" character varying(1024),
        "locale" character varying(16),
        "linkedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_c5fbd93e83dc0b0d1ad366b3ea0" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PRIVACY_CONSENT_USER_ID"
       ON "core"."privacy_consent_event" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PRIVACY_CONSENT_VISITOR_ID"
       ON "core"."privacy_consent_event" ("visitorId")`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "core"."privacy_consent_event"
          ADD CONSTRAINT "FK_0355c07409fbb5f37fa9176425b"
          FOREIGN KEY ("userId") REFERENCES "core"."user"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN null; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."privacy_consent_event"
       DROP CONSTRAINT IF EXISTS "FK_0355c07409fbb5f37fa9176425b"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_PRIVACY_CONSENT_VISITOR_ID"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_PRIVACY_CONSENT_USER_ID"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."privacy_consent_event"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "core"."privacy_consent_event_source_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "core"."privacy_consent_event_action_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "core"."privacy_consent_event_consenttype_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."aiProviderCredential"
       DROP CONSTRAINT IF EXISTS "FK_72a8e71a937eec71061081a8dcc"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_AI_PROVIDER_CREDENTIAL_WORKSPACE_ID"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."aiProviderCredential"`,
    );
  }
}
