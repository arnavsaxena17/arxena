import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

// Port of workflows TypeORM migrations:
// - 1740700000000-createUnipileAccountsTable
// - 1740800000000-addUnipileAccountsAccountIdLookupIndex
// Keeps the `metadata` schema qualifier used by UnipileAccountPoolService /
// WorkspaceModificationsService (current Twenty default DS is `core`).
@RegisteredInstanceCommand('2.25.0', 1785600000011)
export class CreateUnipileAccountsTableFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "metadata"`);

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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_unipile_accounts_account_id_type"
      ON "metadata"."unipile_accounts" ("account_id", "account_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "metadata"."idx_unipile_accounts_account_id_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "metadata"."idx_unipile_accounts_last_active"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "metadata"."unipile_accounts"`,
    );
  }
}
