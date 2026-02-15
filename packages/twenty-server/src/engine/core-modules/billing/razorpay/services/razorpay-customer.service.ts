/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import Razorpay from 'razorpay';
import { Repository } from 'typeorm';

import { BillingCustomer } from 'src/engine/core-modules/billing/entities/billing-customer.entity';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

type RazorpayCustomer = { id: string; email: string; name?: string };

@Injectable()
export class RazorpayCustomerService {
  protected readonly logger = new Logger(RazorpayCustomerService.name);
  private readonly razorpay: Razorpay | null;

  constructor(
    private readonly environmentService: EnvironmentService,
    @InjectRepository(BillingCustomer, 'core')
    private readonly billingCustomerRepository: Repository<BillingCustomer>,
  ) {
    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID') as string | undefined;
    const keySecret = this.environmentService.get('BILLING_RAZORPAY_KEY_SECRET') as string | undefined;
    if (typeof keyId === 'string' && typeof keySecret === 'string') {
      this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    } else {
      this.razorpay = null;
    }
  }

  private getRazorpay(): Razorpay {
    if (!this.razorpay) {
      throw new Error(
        'Razorpay is not configured (missing BILLING_RAZORPAY_KEY_ID or KEY_SECRET)',
      );
    }
    return this.razorpay;
  }

  /**
   * Returns existing Razorpay customer id for this workspace if one exists (from BillingCustomer),
   * otherwise creates a new customer in Razorpay and saves razorpayCustomerId to BillingCustomer.
   */
  async getOrCreateCustomer({
    email,
    workspaceId,
    name,
  }: {
    email: string;
    workspaceId: string;
    name?: string;
  }): Promise<RazorpayCustomer> {
    const existing = await this.billingCustomerRepository.findOne({
      where: { workspaceId },
    });

    if (existing?.razorpayCustomerId) {
      try {
        const customer = (await this.getRazorpay().customers.fetch(
          existing.razorpayCustomerId,
        )) as RazorpayCustomer;
        return {
          id: customer.id,
          email: customer.email ?? email,
          name: customer.name ?? name,
        };
      } catch {
        this.logger.warn(
          `Razorpay customer ${existing.razorpayCustomerId} not found, creating new`,
        );
      }
    }

    const api = this.getRazorpay();
    const created = (await api.customers.create({
      email,
      name: name ?? email.split('@')[0],
      notes: { workspaceId },
      fail_existing: 0,
    })) as RazorpayCustomer;

    if (existing) {
      await this.billingCustomerRepository.update(
        { id: existing.id },
        { razorpayCustomerId: created.id },
      );
    } else {
      await this.billingCustomerRepository.insert({
        workspaceId,
        stripeCustomerId: null,
        razorpayCustomerId: created.id,
      });
    }

    return {
      id: created.id,
      email: created.email ?? email,
      name: created.name ?? name,
    };
  }
}
