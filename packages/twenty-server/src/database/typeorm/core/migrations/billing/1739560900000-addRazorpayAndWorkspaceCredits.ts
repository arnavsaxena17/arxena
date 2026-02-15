import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRazorpayAndWorkspaceCredits1739560900000
  implements MigrationInterface
{
  name = 'AddRazorpayAndWorkspaceCredits1739560900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ALTER COLUMN "stripeCustomerId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ADD "razorpayCustomerId" character varying`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_billingCustomer_razorpayCustomerId" ON "core"."billingCustomer" ("razorpayCustomerId") WHERE "razorpayCustomerId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeCustomerId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeSubscriptionId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ADD "razorpaySubscriptionId" character varying`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_billingSubscription_razorpaySubscriptionId" ON "core"."billingSubscription" ("razorpaySubscriptionId") WHERE "razorpaySubscriptionId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."billingEntitlement" ALTER COLUMN "stripeCustomerId" DROP NOT NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "core"."workspaceCredits" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "workspaceId" uuid NOT NULL,
        "credits" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_workspaceCredits" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_workspaceCredits_workspaceId" UNIQUE ("workspaceId")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."billingEntitlement" ALTER COLUMN "stripeCustomerId" SET NOT NULL`,
    );

    await queryRunner.query(`DROP TABLE "core"."workspaceCredits"`);

    await queryRunner.query(
      `DROP INDEX "core"."UQ_billingSubscription_razorpaySubscriptionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" DROP COLUMN "razorpaySubscriptionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeSubscriptionId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeCustomerId" SET NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX "core"."UQ_billingCustomer_razorpayCustomerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" DROP COLUMN "razorpayCustomerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ALTER COLUMN "stripeCustomerId" SET NOT NULL`,
    );
  }
}
