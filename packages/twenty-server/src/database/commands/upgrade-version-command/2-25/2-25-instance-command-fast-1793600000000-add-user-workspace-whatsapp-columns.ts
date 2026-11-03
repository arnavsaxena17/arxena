import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

// The whatsapp agent columns were added to UserWorkspaceEntity without a
// matching instance command, so every full-entity read of core.userWorkspace
// failed with "column UserWorkspaceEntity.whatsappPhoneE164 does not exist".
@RegisteredInstanceCommand('2.25.0', 1793600000000)
export class AddUserWorkspaceWhatsappColumnsFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."userWorkspace"
      ADD COLUMN IF NOT EXISTS "whatsappPhoneE164" character varying,
      ADD COLUMN IF NOT EXISTS "whatsappAgentNumberId" character varying,
      ADD COLUMN IF NOT EXISTS "whatsappActiveThreadId" uuid,
      ADD COLUMN IF NOT EXISTS "whatsappConnectedAt" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "whatsappLastInboundAt" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "whatsappStatus" character varying
    `);

    // Inbound webhook lookup resolves one workspace per verified phone number.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_workspace_whatsapp_phone_e164"
      ON "core"."userWorkspace" ("whatsappPhoneE164")
      WHERE "whatsappPhoneE164" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "core"."IDX_user_workspace_whatsapp_phone_e164"
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."userWorkspace"
      DROP COLUMN IF EXISTS "whatsappStatus",
      DROP COLUMN IF EXISTS "whatsappLastInboundAt",
      DROP COLUMN IF EXISTS "whatsappConnectedAt",
      DROP COLUMN IF EXISTS "whatsappActiveThreadId",
      DROP COLUMN IF EXISTS "whatsappAgentNumberId",
      DROP COLUMN IF EXISTS "whatsappPhoneE164"
    `);
  }
}
