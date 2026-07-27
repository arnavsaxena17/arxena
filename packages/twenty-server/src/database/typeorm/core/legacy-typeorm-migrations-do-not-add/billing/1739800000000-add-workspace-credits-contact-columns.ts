import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceCreditsContactColumns1739800000000
  implements MigrationInterface
{
  name = 'AddWorkspaceCreditsContactColumns1739800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Schema may already be past this migration (orgChartCredits present,
    // credits already dropped / revealCredits unified later).
    const existingOrgChartCreditsColumn = await queryRunner.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'core'
         AND table_name = 'workspaceCredits'
         AND column_name = 'orgChartCredits'
       LIMIT 1`,
    );

    if (existingOrgChartCreditsColumn.length > 0) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD COLUMN IF NOT EXISTS "orgChartCredits" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD COLUMN IF NOT EXISTS "emailContactCredits" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD COLUMN IF NOT EXISTS "phoneContactCredits" integer NOT NULL DEFAULT 0`,
    );

    const existingCreditsColumn = await queryRunner.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'core'
         AND table_name = 'workspaceCredits'
         AND column_name = 'credits'
       LIMIT 1`,
    );

    if (existingCreditsColumn.length > 0) {
      await queryRunner.query(
        `UPDATE "core"."workspaceCredits" SET "orgChartCredits" = "credits"`,
      );
      await queryRunner.query(
        `ALTER TABLE "core"."workspaceCredits" DROP COLUMN "credits"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD COLUMN IF NOT EXISTS "credits" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `UPDATE "core"."workspaceCredits" SET "credits" = "orgChartCredits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN IF EXISTS "phoneContactCredits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN IF EXISTS "emailContactCredits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN IF EXISTS "orgChartCredits"`,
    );
  }
}
