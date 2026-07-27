import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

// Keeps Razorpay catalog rows queryable as PRO / BASE_PRODUCT after migrate:prod.
// billing:sync-plans-data historically inserted razorpay_base with metadata {}.
@RegisteredInstanceCommand('2.25.0', 1785600000008)
export class EnsureRazorpayBaseProductMetadataFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(
      `SELECT 1 FROM pg_tables WHERE schemaname = 'core' AND tablename = 'billingProduct'`,
    );

    if (tableExists.length === 0) {
      return;
    }

    const hasRazorpayProduct = await queryRunner.query(
      `SELECT 1 FROM "core"."billingProduct" WHERE "stripeProductId" = 'razorpay_base' LIMIT 1`,
    );

    let hasRazorpayPrice: unknown[] = [];
    const billingPriceTableExists = await queryRunner.query(
      `SELECT 1 FROM pg_tables WHERE schemaname = 'core' AND tablename = 'billingPrice'`,
    );

    if (billingPriceTableExists.length > 0) {
      hasRazorpayPrice = await queryRunner.query(
        `SELECT 1 FROM "core"."billingPrice" WHERE "razorpayPlanId" IS NOT NULL LIMIT 1`,
      );
    }

    const shouldEnsureRazorpayBase =
      process.env.BILLING_PROVIDER === 'razorpay' ||
      hasRazorpayProduct.length > 0 ||
      hasRazorpayPrice.length > 0;

    if (!shouldEnsureRazorpayBase) {
      return;
    }

    await queryRunner.query(
      `INSERT INTO "core"."billingProduct" (
        "id",
        "createdAt",
        "updatedAt",
        "active",
        "description",
        "name",
        "images",
        "marketingFeatures",
        "stripeProductId",
        "metadata"
      ) VALUES (
        gen_random_uuid(),
        now(),
        now(),
        true,
        '',
        'Razorpay Base',
        '[]'::jsonb,
        '[]'::jsonb,
        'razorpay_base',
        '{"planKey":"PRO","productKey":"BASE_PRODUCT","priceUsageBased":"LICENSED"}'::jsonb
      )
      ON CONFLICT ("stripeProductId") DO UPDATE SET
        "metadata" = EXCLUDED."metadata",
        "active" = true,
        "updatedAt" = now()`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Data backfill — leave existing catalog rows in place.
  }
}
