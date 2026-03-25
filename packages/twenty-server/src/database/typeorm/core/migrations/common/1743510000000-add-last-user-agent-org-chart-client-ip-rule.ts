import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastUserAgentOrgChartClientIpRule1743510000000
  implements MigrationInterface
{
  name = 'AddLastUserAgentOrgChartClientIpRule1743510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."org_chart_client_ip_rule" ADD "lastUserAgent" character varying(1024)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."org_chart_client_ip_rule" DROP COLUMN "lastUserAgent"`,
    );
  }
}
