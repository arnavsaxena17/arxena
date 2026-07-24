/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import { isDefined, isNonEmptyString } from 'twenty-shared/utils';

import type Stripe from 'stripe';

import {
  BILLING_REQUIRED_STRIPE_CATALOG,
  type BillingRequiredStripeCatalogPrice,
  type BillingRequiredStripeCatalogProduct,
} from 'src/engine/core-modules/billing/constants/billing-required-stripe-catalog.constant';
import { BillingProductKey } from 'src/engine/core-modules/billing/enums/billing-product-key.enum';
import { StripePriceService } from 'src/engine/core-modules/billing/stripe/services/stripe-price.service';
import { StripeProductService } from 'src/engine/core-modules/billing/stripe/services/stripe-product.service';
import { type BillingProductMetadata } from 'src/engine/core-modules/billing/types/billing-product-metadata.type';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

type EnsureRequiredCatalogOptions = {
  dryRun?: boolean;
};

@Injectable()
export class BillingStripeCatalogService {
  private readonly logger = new Logger(BillingStripeCatalogService.name);

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly stripeProductService: StripeProductService,
    private readonly stripePriceService: StripePriceService,
  ) {}

  async ensureRequiredCatalog(
    options: EnsureRequiredCatalogOptions = {},
  ): Promise<void> {
    if (!this.twentyConfigService.get('IS_BILLING_ENABLED')) {
      throw new Error(
        'IS_BILLING_ENABLED must be true to ensure the Stripe billing catalog',
      );
    }

    const products = await this.stripeProductService.getAllProducts();

    for (const catalogProduct of BILLING_REQUIRED_STRIPE_CATALOG) {
      const product = await this.ensureProduct({
        catalogProduct,
        products,
        dryRun: options.dryRun === true,
      });

      const prices = await this.stripePriceService.getPricesByProductId(
        product.id,
      );

      for (const catalogPrice of catalogProduct.prices) {
        await this.ensurePrice({
          catalogProduct,
          catalogPrice,
          product,
          prices,
          dryRun: options.dryRun === true,
        });
      }
    }
  }

  async assertRequiredCatalogExistsInStripe(): Promise<void> {
    const products = await this.stripeProductService.getAllProducts();

    for (const catalogProduct of BILLING_REQUIRED_STRIPE_CATALOG) {
      const product = this.findProductByMetadata(products, catalogProduct);

      if (!isDefined(product)) {
        throw new Error(
          `Missing Stripe product for ${catalogProduct.planKey}/${catalogProduct.productKey}. Run billing:sync-plans-data --ensure-catalog`,
        );
      }

      const prices = await this.stripePriceService.getPricesByProductId(
        product.id,
      );

      for (const catalogPrice of catalogProduct.prices) {
        const matchingPrice = this.findMatchingPrice(prices, catalogPrice);

        if (!isDefined(matchingPrice)) {
          throw new Error(
            `Missing Stripe ${catalogPrice.interval} price for ${catalogProduct.planKey}/${catalogProduct.productKey}. Run billing:sync-plans-data --ensure-catalog`,
          );
        }
      }
    }
  }

  private async ensureProduct({
    catalogProduct,
    products,
    dryRun,
  }: {
    catalogProduct: BillingRequiredStripeCatalogProduct;
    products: Stripe.Product[];
    dryRun: boolean;
  }): Promise<Stripe.Product> {
    const metadata = this.buildProductMetadata(catalogProduct);
    let product = this.findProductByMetadata(products, catalogProduct);

    if (!isDefined(product) && isDefined(catalogProduct.seedProductIdConfigKey)) {
      const seedProductId = this.twentyConfigService.get(
        catalogProduct.seedProductIdConfigKey,
      );

      if (isNonEmptyString(seedProductId)) {
        product = await this.stripeProductService.getProductById(seedProductId);
        this.logger.log(
          `Using seeded Stripe product ${seedProductId} for ${catalogProduct.planKey}/${catalogProduct.productKey}`,
        );
      }
    }

    if (isDefined(product)) {
      if (!this.hasExactProductMetadata(product.metadata, metadata)) {
        if (dryRun) {
          this.logger.log(
            `[dry-run] Would update metadata on ${product.id} to ${JSON.stringify(metadata)}`,
          );
        } else {
          product = await this.stripeProductService.updateProductMetadata({
            productId: product.id,
            metadata,
          });
          this.logger.log(`Updated metadata on Stripe product ${product.id}`);
        }
      } else {
        this.logger.log(
          `Stripe product ${product.id} already has required metadata for ${catalogProduct.planKey}/${catalogProduct.productKey}`,
        );
      }

      return product;
    }

    if (!catalogProduct.createProductIfMissing) {
      throw new Error(
        `Missing Stripe product for ${catalogProduct.planKey}/${catalogProduct.productKey}. Set ${catalogProduct.seedProductIdConfigKey ?? 'a seed product id'} or create the product in Stripe with the required metadata.`,
      );
    }

    if (dryRun) {
      this.logger.log(
        `[dry-run] Would create product "${catalogProduct.name}" with metadata ${JSON.stringify(metadata)}`,
      );

      return {
        id: 'dry_run_product',
        metadata,
        name: catalogProduct.name,
      } as Stripe.Product;
    }

    const createdProduct = await this.stripeProductService.createProduct({
      name: catalogProduct.name,
      metadata,
    });

    products.push(createdProduct);
    this.logger.log(
      `Created Stripe product ${createdProduct.id} for ${catalogProduct.planKey}/${catalogProduct.productKey}`,
    );

    return createdProduct;
  }

  private async ensurePrice({
    catalogProduct,
    catalogPrice,
    product,
    prices,
    dryRun,
  }: {
    catalogProduct: BillingRequiredStripeCatalogProduct;
    catalogPrice: BillingRequiredStripeCatalogPrice;
    product: Stripe.Product;
    prices: Stripe.Price[];
    dryRun: boolean;
  }): Promise<void> {
    const matchingPrice = this.findMatchingPrice(prices, catalogPrice);

    if (isDefined(matchingPrice)) {
      this.logger.log(
        `Stripe price ${matchingPrice.id} already covers ${catalogProduct.planKey}/${catalogProduct.productKey}/${catalogPrice.interval}`,
      );

      return;
    }

    if (catalogProduct.productKey === BillingProductKey.BASE_PRODUCT) {
      throw new Error(
        `Missing ${catalogPrice.interval} price on base product ${product.id} (${catalogProduct.planKey}). Create the price in Stripe, then re-run sync.`,
      );
    }

    const metadata = isDefined(catalogPrice.creditAmount)
      ? { credit_amount: String(catalogPrice.creditAmount) }
      : undefined;

    if (dryRun) {
      this.logger.log(
        `[dry-run] Would create ${catalogPrice.interval} price on ${product.id} unit_amount=${catalogPrice.unitAmount} metadata=${JSON.stringify(metadata ?? {})}`,
      );

      return;
    }

    const createdPrice =
      await this.stripePriceService.createLicensedRecurringPrice({
        productId: product.id,
        interval: catalogPrice.interval,
        unitAmount: catalogPrice.unitAmount,
        metadata,
      });

    prices.push(createdPrice);
    this.logger.log(
      `Created Stripe price ${createdPrice.id} for ${catalogProduct.planKey}/${catalogProduct.productKey}/${catalogPrice.interval}`,
    );
  }

  private findProductByMetadata(
    products: Stripe.Product[],
    catalogProduct: BillingRequiredStripeCatalogProduct,
  ) {
    return products.find(
      (product) =>
        product.metadata.planKey === catalogProduct.planKey &&
        product.metadata.productKey === catalogProduct.productKey &&
        product.metadata.priceUsageBased === catalogProduct.priceUsageBased,
    );
  }

  private findMatchingPrice(
    prices: Stripe.Price[],
    catalogPrice: BillingRequiredStripeCatalogPrice,
  ) {
    return prices.find((price) => {
      if (price.active !== true) {
        return false;
      }

      if (price.recurring?.interval !== catalogPrice.interval) {
        return false;
      }

      if (!isDefined(catalogPrice.creditAmount)) {
        return true;
      }

      return (
        price.metadata?.credit_amount === String(catalogPrice.creditAmount) ||
        isNonEmptyString(price.metadata?.credit_amount)
      );
    });
  }

  private buildProductMetadata(
    catalogProduct: BillingRequiredStripeCatalogProduct,
  ): BillingProductMetadata {
    return {
      planKey: catalogProduct.planKey,
      productKey: catalogProduct.productKey,
      priceUsageBased: catalogProduct.priceUsageBased,
    };
  }

  private hasExactProductMetadata(
    metadata: Stripe.Metadata,
    expected: BillingProductMetadata,
  ) {
    return (
      metadata.planKey === expected.planKey &&
      metadata.productKey === expected.productKey &&
      metadata.priceUsageBased === expected.priceUsageBased
    );
  }
}
