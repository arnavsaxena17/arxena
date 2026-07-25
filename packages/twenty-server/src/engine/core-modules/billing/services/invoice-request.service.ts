/* @license Enterprise */

import { Injectable } from '@nestjs/common';

import { RAZORPAY_CREDIT_PACKS } from 'src/engine/core-modules/billing/razorpay/constants/credit-packs.constant';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import {
  getCreditPackTierPrice,
  SUPPORTED_PRICING_CURRENCIES,
  type SupportedPricingCurrency,
} from 'twenty-shared';

const BILLING_INVOICE_EMAIL = 'hello@arxena.com';

type RequestInvoiceParams = {
  workspaceId: string;
  userEmail: string;
  creditPackKey: string;
  companyName: string;
  billingAddress: string;
  billingEmail: string;
  vatNumber?: string;
  currency?: string;
};

@Injectable()
export class InvoiceRequestService {
  constructor(
    private readonly emailService: EmailService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async requestInvoice(params: RequestInvoiceParams): Promise<void> {
    const pack = RAZORPAY_CREDIT_PACKS.find(
      (p) => p.key === params.creditPackKey,
    );
    if (!pack) {
      throw new Error(`Unknown credit pack: ${params.creditPackKey}`);
    }

    const requestedCurrency = this.toSupportedCurrency(params.currency);
    const sourceCurrency = this.toSupportedCurrency(pack.currency) ?? 'GBP';
    const displayCurrency: SupportedPricingCurrency =
      requestedCurrency ?? sourceCurrency;
    const amountSubunits = getCreditPackTierPrice(pack, displayCurrency);

    const amountFormatted = (amountSubunits / 100).toLocaleString();
    const packDescription = `${pack.name} — ${displayCurrency} ${amountFormatted}`;

    const fromName = this.environmentService.get('EMAIL_FROM_NAME') ?? 'Arxena';
    const fromAddress =
      this.environmentService.get('EMAIL_FROM_ADDRESS') ?? 'no-reply@arxena.com';
    const from = `${fromName} <${fromAddress}>`;

    await this.emailService.send({
      from,
      to: BILLING_INVOICE_EMAIL,
      subject: `Invoice request: ${params.companyName} — ${pack.name}`,
      text: [
        'Invoice request for credit pack',
        '',
        `Workspace ID: ${params.workspaceId}`,
        `User email: ${params.userEmail}`,
        `Pack: ${packDescription}`,
        '',
        'Company details:',
        `Company name: ${params.companyName}`,
        `Billing address: ${params.billingAddress}`,
        `Billing email: ${params.billingEmail}`,
        params.vatNumber ? `VAT number: ${params.vatNumber}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    });

    await this.emailService.send({
      from,
      to: params.billingEmail,
      subject: `Invoice request received — ${pack.name}`,
      text: [
        `We've received your invoice request for ${pack.name} (${displayCurrency} ${amountFormatted}).`,
        '',
        "We'll send your invoice within 1-2 business days.",
        '',
        'If you have any questions, reply to this email.',
      ].join('\n'),
    });
  }

  private toSupportedCurrency(
    currency: string | undefined,
  ): SupportedPricingCurrency | null {
    if (!currency) return null;
    return SUPPORTED_PRICING_CURRENCIES.includes(
      currency as SupportedPricingCurrency,
    )
      ? (currency as SupportedPricingCurrency)
      : null;
  }
}
