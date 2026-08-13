import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.25.0', 1785600000020)
export class AddWebsiteTrackingColumnsFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."workspace"
      ADD COLUMN IF NOT EXISTS "website_tracking_app_id" varchar(255),
      ADD COLUMN IF NOT EXISTS "website_tracking_enabled" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_workspace_website_tracking_app_id"
      ON "core"."workspace" ("website_tracking_app_id")
      WHERE "website_tracking_app_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "core"."IDX_workspace_website_tracking_app_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."workspace"
      DROP COLUMN IF EXISTS "website_tracking_enabled",
      DROP COLUMN IF EXISTS "website_tracking_app_id"
    `);
  }
}
