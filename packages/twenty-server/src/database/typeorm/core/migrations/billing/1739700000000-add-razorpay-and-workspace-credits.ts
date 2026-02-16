import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRazorpayAndWorkspaceCredits1739700000000
  implements MigrationInterface
{
  name = 'AddRazorpayAndWorkspaceCredits1739700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."workspaceCredits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "workspaceId" uuid NOT NULL,
        "credits" integer NOT NULL DEFAULT 0,
        CONSTRAINT "UQ_workspaceCredits_workspaceId" UNIQUE ("workspaceId"),
        CONSTRAINT "PK_workspaceCredits" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ADD "paymentProvider" character varying NOT NULL DEFAULT 'stripe'`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ADD "razorpayCustomerId" character varying`,
    );
    // Drop FK from billingEntitlement that depends on stripeCustomerId unique constraint
    await queryRunner.query(
      `ALTER TABLE "core"."billingEntitlement" DROP CONSTRAINT IF EXISTS "FK_766a1918aa3dbe0d67d3df62356"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" DROP CONSTRAINT IF EXISTS "UQ_b35a0ef2e2f0d40101dd7f161b9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ALTER COLUMN "stripeCustomerId" DROP NOT NULL`,
    );
    // Re-add unique on stripeCustomerId (UNIQUE allows multiple NULLs in PostgreSQL)
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ADD CONSTRAINT "UQ_billingCustomer_stripeCustomerId" UNIQUE ("stripeCustomerId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingEntitlement" ADD CONSTRAINT "FK_766a1918aa3dbe0d67d3df62356" FOREIGN KEY ("stripeCustomerId") REFERENCES "core"."billingCustomer"("stripeCustomerId") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ADD "razorpaySubscriptionId" character varying`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_billingSubscription_razorpaySubscriptionId" ON "core"."billingSubscription" ("razorpaySubscriptionId") WHERE "razorpaySubscriptionId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeCustomerId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeSubscriptionId" DROP NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."billingPrice" ADD "razorpayPlanId" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."billingPrice" DROP COLUMN "razorpayPlanId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeSubscriptionId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeCustomerId" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "core"."UQ_billingSubscription_razorpaySubscriptionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" DROP COLUMN "razorpaySubscriptionId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."billingEntitlement" DROP CONSTRAINT IF EXISTS "FK_766a1918aa3dbe0d67d3df62356"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" DROP CONSTRAINT IF EXISTS "UQ_billingCustomer_stripeCustomerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ALTER COLUMN "stripeCustomerId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ADD CONSTRAINT "UQ_b35a0ef2e2f0d40101dd7f161b9" UNIQUE ("stripeCustomerId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingEntitlement" ADD CONSTRAINT "FK_766a1918aa3dbe0d67d3df62356" FOREIGN KEY ("stripeCustomerId") REFERENCES "core"."billingCustomer"("stripeCustomerId") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" DROP COLUMN "razorpayCustomerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" DROP COLUMN "paymentProvider"`,
    );

    await queryRunner.query(`DROP TABLE "core"."workspaceCredits"`);
  }
}
