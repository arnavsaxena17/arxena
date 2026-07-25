import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.25.0', 1785600000003)
export class AddOrgChartClientIpRuleFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."org_chart_client_ip_rule" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ipAddress" character varying(64) NOT NULL,
        "isBlocked" boolean NOT NULL DEFAULT false,
        "serveCachedOnly" boolean NOT NULL DEFAULT false,
        "totalRequests" integer NOT NULL DEFAULT 0,
        "chartsServed" integer NOT NULL DEFAULT 0,
        "lastUserAgent" character varying(1024),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_chart_client_ip_rule" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ORG_CHART_CLIENT_IP_RULE_IP"
      ON "core"."org_chart_client_ip_rule" ("ipAddress")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."UQ_ORG_CHART_CLIENT_IP_RULE_IP"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."org_chart_client_ip_rule"`,
    );
  }
}
