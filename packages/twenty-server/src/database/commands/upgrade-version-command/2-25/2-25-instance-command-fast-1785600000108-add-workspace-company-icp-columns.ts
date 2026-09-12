import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.25.0', 1785600000108)
export class AddWorkspaceCompanyIcpColumnsFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."workspace"
      ADD COLUMN IF NOT EXISTS "company_name" text,
      ADD COLUMN IF NOT EXISTS "company_domain" text,
      ADD COLUMN IF NOT EXISTS "industry" text,
      ADD COLUMN IF NOT EXISTS "summary" text,
      ADD COLUMN IF NOT EXISTS "employee_range" text,
      ADD COLUMN IF NOT EXISTS "hq" text,
      ADD COLUMN IF NOT EXISTS "enrichment_json" jsonb,
      ADD COLUMN IF NOT EXISTS "icp_spec" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."workspace"
      DROP COLUMN IF EXISTS "icp_spec",
      DROP COLUMN IF EXISTS "enrichment_json",
      DROP COLUMN IF EXISTS "hq",
      DROP COLUMN IF EXISTS "employee_range",
      DROP COLUMN IF EXISTS "summary",
      DROP COLUMN IF EXISTS "industry",
      DROP COLUMN IF EXISTS "company_domain",
      DROP COLUMN IF EXISTS "company_name"
    `);
  }
}
