import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.25.0', 1785600000001)
export class AddWorkspaceCreditsAndCreditTransactionsFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."workspaceCredits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "workspaceId" uuid NOT NULL,
        "orgChartCredits" integer NOT NULL DEFAULT 0,
        "revealCredits" integer NOT NULL DEFAULT 0,
        CONSTRAINT "UQ_workspaceCredits_workspaceId" UNIQUE ("workspaceId"),
        CONSTRAINT "PK_workspaceCredits" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."creditTransactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "workspaceId" uuid NOT NULL,
        "type" varchar(20) NOT NULL,
        "creditType" varchar(30) NOT NULL,
        "amount" integer NOT NULL,
        "metadata" jsonb,
        CONSTRAINT "PK_creditTransactions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_creditTransactions_workspaceId_createdAt"
      ON "core"."creditTransactions" ("workspaceId", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_creditTransactions_workspaceId_createdAt"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."creditTransactions"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."workspaceCredits"`);
  }
}
