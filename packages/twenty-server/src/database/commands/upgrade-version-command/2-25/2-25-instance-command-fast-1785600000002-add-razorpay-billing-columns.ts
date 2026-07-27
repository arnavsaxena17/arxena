import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.25.0', 1785600000002)
export class AddRazorpayBillingColumnsFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(
      `SELECT 1 FROM pg_tables WHERE schemaname = 'core' AND tablename = 'billingCustomer'`,
    );

    if (tableExists.length === 0) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ADD COLUMN IF NOT EXISTS "paymentProvider" character varying NOT NULL DEFAULT 'stripe'`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" ADD COLUMN IF NOT EXISTS "razorpayCustomerId" character varying`,
    );

    // Allow Stripe-less Razorpay customers (UNIQUE still allows multiple NULLs).
    // Drop dependent FKs before rewriting the unique constraint.
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
    const tableExists = await queryRunner.query(
      `SELECT 1 FROM pg_tables WHERE schemaname = 'core' AND tablename = 'billingCustomer'`,
    );

    if (tableExists.length === 0) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "core"."billingPrice" DROP COLUMN IF EXISTS "razorpayPlanId"`,
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
      `ALTER TABLE "core"."billingCustomer" DROP COLUMN IF EXISTS "razorpayCustomerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."billingCustomer" DROP COLUMN IF EXISTS "paymentProvider"`,
    );
  }
}
