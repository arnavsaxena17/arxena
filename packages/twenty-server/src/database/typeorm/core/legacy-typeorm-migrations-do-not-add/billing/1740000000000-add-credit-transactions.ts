import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditTransactions1740000000000 implements MigrationInterface {
  name = 'AddCreditTransactions1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core"."creditTransactions" (
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
    await queryRunner.query(
      `CREATE INDEX "IDX_creditTransactions_workspaceId_createdAt" ON "core"."creditTransactions" ("workspaceId", "createdAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "core"."IDX_creditTransactions_workspaceId_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE "core"."creditTransactions"`);
  }
}
