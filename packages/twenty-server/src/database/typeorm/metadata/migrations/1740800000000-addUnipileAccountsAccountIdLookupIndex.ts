import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnipileAccountsAccountIdLookupIndex1740800000000
  implements MigrationInterface
{
  name = 'AddUnipileAccountsAccountIdLookupIndex1740800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_unipile_accounts_account_id_type"
      ON "metadata"."unipile_accounts" ("account_id", "account_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "metadata"."idx_unipile_accounts_account_id_type"`,
    );
  }
}
