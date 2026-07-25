import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceCreditsContactColumns1739800000000
  implements MigrationInterface
{
  name = 'AddWorkspaceCreditsContactColumns1739800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD "orgChartCredits" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD "emailContactCredits" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD "phoneContactCredits" integer NOT NULL DEFAULT 0`,
    );

    // Migrate existing credits to orgChartCredits
    await queryRunner.query(
      `UPDATE "core"."workspaceCredits" SET "orgChartCredits" = "credits"`,
    );

    // Drop old credits column
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN "credits"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back credits column
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" ADD "credits" integer NOT NULL DEFAULT 0`,
    );

    // Migrate orgChartCredits back to credits
    await queryRunner.query(
      `UPDATE "core"."workspaceCredits" SET "credits" = "orgChartCredits"`,
    );

    // Drop new columns
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN "phoneContactCredits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN "emailContactCredits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."workspaceCredits" DROP COLUMN "orgChartCredits"`,
    );
  }
}
