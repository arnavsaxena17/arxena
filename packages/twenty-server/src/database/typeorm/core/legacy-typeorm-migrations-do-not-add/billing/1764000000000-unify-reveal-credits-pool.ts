import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifyRevealCreditsPool1764000000000 implements MigrationInterface {
  name = 'UnifyRevealCreditsPool1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existingRevealCreditsColumn = await queryRunner.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'core'
         AND table_name = 'workspaceCredits'
         AND column_name = 'revealCredits'
       LIMIT 1`,
    );

    if (existingRevealCreditsColumn.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "core"."workspaceCredits" ADD "revealCredits" integer NOT NULL DEFAULT 0`,
      );

      const existingEmailContactCreditsColumn = await queryRunner.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'core'
           AND table_name = 'workspaceCredits'
           AND column_name = 'emailContactCredits'
         LIMIT 1`,
      );

      if (existingEmailContactCreditsColumn.length > 0) {
        await queryRunner.query(
          `UPDATE "core"."workspaceCredits"
             SET "revealCredits" = COALESCE("emailContactCredits", 0) + COALESCE("phoneContactCredits", 0)`,
        );
      }
    }

    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN IF EXISTS "emailContactCredits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN IF EXISTS "phoneContactCredits"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD COLUMN IF NOT EXISTS "emailContactCredits" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD COLUMN IF NOT EXISTS "phoneContactCredits" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `UPDATE "core"."workspaceCredits"
         SET "emailContactCredits" = "revealCredits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN IF EXISTS "revealCredits"`,
    );
  }
}
