import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

// Turns that resume a thread (an answered question, a retry, a queued message)
// carry no browsing context from the client, so the thread keeps the last one
// it was sent. Without it the model lost the open project and guessed an id.
@RegisteredInstanceCommand('2.25.0', 1793700000000)
export class AddLastBrowsingContextToAgentChatThreadFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."agentChatThread" ADD COLUMN IF NOT EXISTS "lastBrowsingContext" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."agentChatThread" DROP COLUMN IF EXISTS "lastBrowsingContext"`,
    );
  }
}
