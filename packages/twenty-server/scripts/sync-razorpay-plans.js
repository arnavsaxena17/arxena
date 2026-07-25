#!/usr/bin/env node
/* Sync Razorpay plans into core.billingProduct / core.billingPrice.
 *
 * Prefer: npx nx run twenty-server:command -- billing:sync-plans-data
 * Use this when Nest command bootstrap fails locally.
 *
 * Requires BILLING_PROVIDER=razorpay and BILLING_RAZORPAY_* test/live keys in .env
 */
require('dotenv').config();
const { randomUUID } = require('crypto');
const { Client } = require('pg');

const RAZORPAY_BASE_PRODUCT_ID = 'razorpay_base';
const DRY_RUN = process.argv.includes('--dry-run');

const main = async () => {
  const keyId = process.env.BILLING_RAZORPAY_KEY_ID;
  const keySecret = process.env.BILLING_RAZORPAY_KEY_SECRET;
  const provider = process.env.BILLING_PROVIDER;

  if (provider !== 'razorpay') {
    throw new Error('BILLING_PROVIDER must be razorpay');
  }
  if (!keyId || !keySecret) {
    throw new Error('Missing BILLING_RAZORPAY_KEY_ID / BILLING_RAZORPAY_KEY_SECRET');
  }

  // eslint-disable-next-line no-console
  console.log({
    dryRun: DRY_RUN,
    testMode: keyId.startsWith('rzp_test_'),
  });

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/plans', {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    throw new Error(
      `Razorpay plans fetch failed: ${response.status} ${await response.text()}`,
    );
  }

  const plans = (await response.json()).items ?? [];
  // eslint-disable-next-line no-console
  console.log(`Fetched ${plans.length} Razorpay plans`);

  const client = new Client({ connectionString: process.env.PG_DATABASE_URL });
  await client.connect();

  try {
    const existingProduct = await client.query(
      `SELECT id FROM core."billingProduct" WHERE "stripeProductId" = $1`,
      [RAZORPAY_BASE_PRODUCT_ID],
    );

    if (existingProduct.rows.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`Creating product ${RAZORPAY_BASE_PRODUCT_ID}`);
      if (!DRY_RUN) {
        await client.query(
          `INSERT INTO core."billingProduct"
            (id, "stripeProductId", name, active, description, images, "marketingFeatures", metadata)
           VALUES ($1,$2,$3,true,'','[]'::jsonb,'[]'::jsonb,'{}'::jsonb)`,
          [randomUUID(), RAZORPAY_BASE_PRODUCT_ID, 'Razorpay Base'],
        );
      }
    }

    for (const plan of plans) {
      const stripePriceId = `razorpay_plan_${plan.id}`;
      const interval = plan.period === 'yearly' ? 'year' : 'month';
      const recurring = {
        interval:
          plan.period === 'yearly'
            ? 'year'
            : plan.period === 'weekly'
              ? 'week'
              : plan.period === 'daily'
                ? 'day'
                : 'month',
        interval_count: plan.interval,
        usage_type: 'licensed',
        meter: null,
        trial_period_days: null,
      };

      // eslint-disable-next-line no-console
      console.log(
        `Upsert ${stripePriceId} · ${plan.item?.name} · ${plan.item?.currency} ${plan.item?.amount}`,
      );

      if (DRY_RUN) {
        continue;
      }

      await client.query(
        `INSERT INTO core."billingPrice"
          (id, "stripePriceId", "razorpayPlanId", "stripeProductId", active, currency, nickname,
           "taxBehavior", type, "billingScheme", "usageType", interval, recurring,
           "unitAmount", "unitAmountDecimal", metadata)
         VALUES ($1,$2,$3,$4,true,$5,$6,'UNSPECIFIED','RECURRING','PER_UNIT','LICENSED',$7,$8::jsonb,$9,$10,'{}'::jsonb)
         ON CONFLICT ("stripePriceId") DO UPDATE SET
           "razorpayPlanId" = EXCLUDED."razorpayPlanId",
           active = EXCLUDED.active,
           currency = EXCLUDED.currency,
           nickname = EXCLUDED.nickname,
           interval = EXCLUDED.interval,
           recurring = EXCLUDED.recurring,
           "unitAmount" = EXCLUDED."unitAmount",
           "unitAmountDecimal" = EXCLUDED."unitAmountDecimal",
           "updatedAt" = now()`,
        [
          randomUUID(),
          stripePriceId,
          plan.id,
          RAZORPAY_BASE_PRODUCT_ID,
          plan.item.currency,
          plan.item.name,
          interval,
          JSON.stringify(recurring),
          plan.item.amount,
          String(plan.item.amount),
        ],
      );
    }

    const count = await client.query(
      `SELECT count(*)::int AS c FROM core."billingPrice" WHERE "razorpayPlanId" IS NOT NULL`,
    );
    // eslint-disable-next-line no-console
    console.log('Razorpay prices in DB:', count.rows[0].c);
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
