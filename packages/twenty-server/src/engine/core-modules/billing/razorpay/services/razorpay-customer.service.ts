/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

type RazorpayCustomerResponse = {
  id: string;
  email: string;
  contact?: string;
  name?: string;
};

@Injectable()
export class RazorpayCustomerService {
  protected readonly logger = new Logger(RazorpayCustomerService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  async createCustomer(
    email: string,
    workspaceId: string,
    name?: string,
  ): Promise<{ id: string }> {
    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID');
    const keySecret = this.environmentService.get(
      'BILLING_RAZORPAY_KEY_SECRET',
    );
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured');
    }
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const body: { email: string; name?: string; notes?: Record<string, string> } = {
      email,
      notes: { workspaceId },
    };
    if (name) body.name = name;
    const res = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(
        `Razorpay create customer failed: ${res.status} ${errText}`,
      );
      throw new Error(`Razorpay create customer failed: ${res.status}`);
    }
    const data = (await res.json()) as RazorpayCustomerResponse;
    return { id: data.id };
  }
}
