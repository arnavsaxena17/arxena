import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifyRevealCreditsPool1764000000000 implements MigrationInterface {
  name = 'UnifyRevealCreditsPool1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add the unified pool column.
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD "revealCredits" integer NOT NULL DEFAULT 0`,
    );

    // 2) Backfill: sum existing email + phone contact credits (defensive — both
    //    columns are effectively zero today because the webhook never funded
    //    them, but the SUM keeps any manually adjusted balances intact).
    await queryRunner.query(
      `UPDATE "core"."workspaceCredits"
         SET "revealCredits" = COALESCE("emailContactCredits", 0) + COALESCE("phoneContactCredits", 0)`,
    );

    // 3) Drop the legacy columns.
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN "emailContactCredits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN "phoneContactCredits"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add the legacy columns.
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD "emailContactCredits" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD "phoneContactCredits" integer NOT NULL DEFAULT 0`,
    );

    // Restore the previous balances by parking everything in the email column
    // (we cannot recover the original split; this is the best-effort inverse).
    await queryRunner.query(
      `UPDATE "core"."workspaceCredits"
         SET "emailContactCredits" = "revealCredits"`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN "revealCredits"`,
    );
  }
}
