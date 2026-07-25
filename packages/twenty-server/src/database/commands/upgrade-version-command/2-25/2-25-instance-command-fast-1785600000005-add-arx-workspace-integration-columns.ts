import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.25.0', 1785600000005)
export class AddArxWorkspaceIntegrationColumnsFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."workspace"
      ADD COLUMN IF NOT EXISTS "openaikey" varchar(255),
      ADD COLUMN IF NOT EXISTS "twilio_account_sid" varchar(255),
      ADD COLUMN IF NOT EXISTS "twilio_auth_token" varchar(255),
      ADD COLUMN IF NOT EXISTS "linkedin_url" varchar(255),
      ADD COLUMN IF NOT EXISTS "whatsapp_key" varchar(255),
      ADD COLUMN IF NOT EXISTS "linkedin_unipile_account_id" varchar(255),
      ADD COLUMN IF NOT EXISTS "whatsapp_unipile_account_id" varchar(255),
      ADD COLUMN IF NOT EXISTS "linkedin_profile_id" varchar(255),
      ADD COLUMN IF NOT EXISTS "anthropic_key" varchar(255),
      ADD COLUMN IF NOT EXISTS "facebook_whatsapp_api_token" varchar(255),
      ADD COLUMN IF NOT EXISTS "facebook_whatsapp_phone_number_id" varchar(255),
      ADD COLUMN IF NOT EXISTS "whatsapp_web_phone_number" varchar(255),
      ADD COLUMN IF NOT EXISTS "facebook_whatsapp_app_id" varchar(255),
      ADD COLUMN IF NOT EXISTS "facebook_whatsapp_asset_id" varchar(255),
      ADD COLUMN IF NOT EXISTS "is_chrome_extension_installed" varchar(255) DEFAULT 'false',
      ADD COLUMN IF NOT EXISTS "chrome_extension_id" varchar(255),
      ADD COLUMN IF NOT EXISTS "is_org_chart_enabled" varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."workspace"
      DROP COLUMN IF EXISTS "openaikey",
      DROP COLUMN IF EXISTS "twilio_account_sid",
      DROP COLUMN IF EXISTS "twilio_auth_token",
      DROP COLUMN IF EXISTS "linkedin_url",
      DROP COLUMN IF EXISTS "whatsapp_key",
      DROP COLUMN IF EXISTS "linkedin_unipile_account_id",
      DROP COLUMN IF EXISTS "whatsapp_unipile_account_id",
      DROP COLUMN IF EXISTS "linkedin_profile_id",
      DROP COLUMN IF EXISTS "anthropic_key",
      DROP COLUMN IF EXISTS "facebook_whatsapp_api_token",
      DROP COLUMN IF EXISTS "facebook_whatsapp_phone_number_id",
      DROP COLUMN IF EXISTS "whatsapp_web_phone_number",
      DROP COLUMN IF EXISTS "facebook_whatsapp_app_id",
      DROP COLUMN IF EXISTS "facebook_whatsapp_asset_id",
      DROP COLUMN IF EXISTS "is_chrome_extension_installed",
      DROP COLUMN IF EXISTS "chrome_extension_id",
      DROP COLUMN IF EXISTS "is_org_chart_enabled"
    `);
  }
}
