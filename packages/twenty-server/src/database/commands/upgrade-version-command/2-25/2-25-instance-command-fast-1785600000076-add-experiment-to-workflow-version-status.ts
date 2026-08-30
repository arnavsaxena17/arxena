import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.25.0', 1785600000076)
export class AddExperimentToWorkflowVersionStatusFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "core"."workflowVersion_status_enum" ADD VALUE IF NOT EXISTS 'EXPERIMENT' AFTER 'ACTIVE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TYPE \"core\".\"workflowVersion_status_enum_old\" AS ENUM('DRAFT', 'ACTIVE', 'DEACTIVATED', 'ARCHIVED')",
    );
    await queryRunner.query(
      'ALTER TABLE "core"."workflowVersion" ALTER COLUMN "status" DROP DEFAULT',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."workflowVersion" ALTER COLUMN "status" TYPE "core"."workflowVersion_status_enum_old" USING "status"::"text"::"core"."workflowVersion_status_enum_old"',
    );
    await queryRunner.query(
      'ALTER TABLE "core"."workflowVersion" ALTER COLUMN "status" SET DEFAULT \'DRAFT\'',
    );
    await queryRunner.query('DROP TYPE "core"."workflowVersion_status_enum"');
    await queryRunner.query(
      'ALTER TYPE "core"."workflowVersion_status_enum_old" RENAME TO "workflowVersion_status_enum"',
    );
  }
}
