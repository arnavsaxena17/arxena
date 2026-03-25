import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrgChartClientIpRule1743500000000 implements MigrationInterface {
  name = 'OrgChartClientIpRule1743500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."org_chart_client_ip_rule" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ipAddress" character varying(64) NOT NULL,
        "isBlocked" boolean NOT NULL DEFAULT false,
        "serveCachedOnly" boolean NOT NULL DEFAULT false,
        "totalRequests" integer NOT NULL DEFAULT '0',
        "chartsServed" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_chart_client_ip_rule" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ORG_CHART_CLIENT_IP_RULE_IP" ON "core"."org_chart_client_ip_rule" ("ipAddress")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "core"."UQ_ORG_CHART_CLIENT_IP_RULE_IP"`,
    );
    await queryRunner.query(`DROP TABLE "core"."org_chart_client_ip_rule"`);
  }
}
