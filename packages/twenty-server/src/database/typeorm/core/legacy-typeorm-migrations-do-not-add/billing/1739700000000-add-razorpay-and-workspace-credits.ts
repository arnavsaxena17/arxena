import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRazorpayAndWorkspaceCredits1739700000000
  implements MigrationInterface
{
  name = 'AddRazorpayAndWorkspaceCredits1739700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Schema may already exist from the 2.25 instance command or a partial
    // earlier apply. Skip the destructive constraint rewrite in that case.
    const existingPaymentProviderColumn = await queryRunner.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'core'
         AND table_name = 'billingCustomer'
         AND column_name = 'paymentProvider'
       LIMIT 1`,
    );

    if (existingPaymentProviderColumn.length > 0) {
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

      return;
    }

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
      `ALTER TABLE "core"."billingCustomer" ADD COLUMN IF NOT EXISTS "paymentProvider" character varying NOT NULL DEFAULT 'stripe'`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ADD COLUMN IF NOT EXISTS "razorpayCustomerId" character varying`,
    );
    // Drop FKs that depend on the stripeCustomerId unique constraint first
    await queryRunner.query(
      `ALTER TABLE "core"."billingEntitlement" DROP CONSTRAINT IF EXISTS "FK_766a1918aa3dbe0d67d3df62356"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" DROP CONSTRAINT IF EXISTS "FK_6e7dda21d7fd1c0be7b3b07b3c4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" DROP CONSTRAINT IF EXISTS "UQ_b35a0ef2e2f0d40101dd7f161b9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" DROP CONSTRAINT IF EXISTS "UQ_billingCustomer_stripeCustomerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ALTER COLUMN "stripeCustomerId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        ALTER TABLE "core"."billingCustomer"
          ADD CONSTRAINT "UQ_billingCustomer_stripeCustomerId" UNIQUE ("stripeCustomerId");
      EXCEPTION WHEN duplicate_object THEN null; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        ALTER TABLE "core"."billingEntitlement"
          ADD CONSTRAINT "FK_766a1918aa3dbe0d67d3df62356"
          FOREIGN KEY ("stripeCustomerId")
          REFERENCES "core"."billingCustomer"("stripeCustomerId")
          ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        ALTER TABLE "core"."billingSubscription"
          ADD CONSTRAINT "FK_6e7dda21d7fd1c0be7b3b07b3c4"
          FOREIGN KEY ("stripeCustomerId")
          REFERENCES "core"."billingCustomer"("stripeCustomerId")
          ON DELETE CASCADE
          ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN null; END $$`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ADD COLUMN IF NOT EXISTS "razorpaySubscriptionId" character varying`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_billingSubscription_razorpaySubscriptionId" ON "core"."billingSubscription" ("razorpaySubscriptionId") WHERE "razorpaySubscriptionId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeCustomerId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeSubscriptionId" DROP NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."billingPrice" ADD COLUMN IF NOT EXISTS "razorpayPlanId" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."billingPrice" DROP COLUMN IF EXISTS "razorpayPlanId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeSubscriptionId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" ALTER COLUMN "stripeCustomerId" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."UQ_billingSubscription_razorpaySubscriptionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingSubscription" DROP COLUMN IF EXISTS "razorpaySubscriptionId"`,
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
      `ALTER TABLE "core"."billingCustomer" DROP COLUMN IF EXISTS "razorpayCustomerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" DROP COLUMN IF EXISTS "paymentProvider"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "core"."workspaceCredits"`);
  }
}
