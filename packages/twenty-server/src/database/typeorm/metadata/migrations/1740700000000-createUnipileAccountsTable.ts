import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUnipileAccountsTable1740700000000
  implements MigrationInterface
{
  name = 'CreateUnipileAccountsTable1740700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "metadata"."unipile_accounts" (
        "id" SERIAL PRIMARY KEY,
        "workspace_member_id" VARCHAR(255) NOT NULL,
        "workspace_id" VARCHAR(255) NOT NULL,
        "account_id" VARCHAR(255) NOT NULL,
        "account_type" VARCHAR(50) DEFAULT 'LINKEDIN',
        "status" VARCHAR(50) DEFAULT 'OK',
        "last_active" TIMESTAMP DEFAULT NOW(),
        "created_at" TIMESTAMP DEFAULT NOW(),
        UNIQUE ("workspace_member_id", "account_type")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_unipile_accounts_last_active"
      ON "metadata"."unipile_accounts" ("last_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "metadata"."idx_unipile_accounts_last_active"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "metadata"."unipile_accounts"`);
  }
}
