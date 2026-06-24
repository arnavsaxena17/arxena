import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrivacyConsentEvent1744000000000 implements MigrationInterface {
  name = 'PrivacyConsentEvent1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "core"."privacy_consent_event_consenttype_enum" AS ENUM('cookie_banner', 'terms_at_signup')`,
    );
    await queryRunner.query(
      `CREATE TYPE "core"."privacy_consent_event_action_enum" AS ENUM('accept_all', 'reject_all', 'custom', 'withdraw')`,
    );
    await queryRunner.query(
      `CREATE TYPE "core"."privacy_consent_event_source_enum" AS ENUM('website', 'app')`,
    );
    await queryRunner.query(
      `CREATE TABLE "core"."privacy_consent_event" (
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
        CONSTRAINT "PK_privacy_consent_event" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_PRIVACY_CONSENT_VISITOR_ID" ON "core"."privacy_consent_event" ("visitorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_PRIVACY_CONSENT_USER_ID" ON "core"."privacy_consent_event" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."privacy_consent_event" ADD CONSTRAINT "FK_privacy_consent_event_user" FOREIGN KEY ("userId") REFERENCES "core"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."privacy_consent_event" DROP CONSTRAINT "FK_privacy_consent_event_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_PRIVACY_CONSENT_USER_ID"`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."IDX_PRIVACY_CONSENT_VISITOR_ID"`,
    );
    await queryRunner.query(`DROP TABLE "core"."privacy_consent_event"`);
    await queryRunner.query(
      `DROP TYPE "core"."privacy_consent_event_source_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "core"."privacy_consent_event_action_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "core"."privacy_consent_event_consenttype_enum"`,
    );
  }
}
