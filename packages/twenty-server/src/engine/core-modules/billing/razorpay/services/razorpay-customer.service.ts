/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

type RazorpayCustomerResponse = {
  id: string;
  email: string;
  contact?: string;
  name?: string;
};

type RazorpayFetchAllResponse = {
  entity: string;
  count: number;
  items: RazorpayCustomerResponse[];
};

@Injectable()
export class RazorpayCustomerService {
  protected readonly logger = new Logger(RazorpayCustomerService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  private getAuth(): string {
    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID');
    const keySecret = this.environmentService.get(
      'BILLING_RAZORPAY_KEY_SECRET',
    );
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured');
    }
    return Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  }

  async createCustomer(
    email: string,
    workspaceId: string,
    name?: string,
  ): Promise<{ id: string }> {
    const auth = this.getAuth();
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
    if (res.ok) {
      const data = (await res.json()) as RazorpayCustomerResponse;
      return { id: data.id };
    }
    const errText = await res.text();
    const isAlreadyExists =
      res.status === 400 &&
      (errText.includes('already exists') ||
        errText.includes('Customer already exists'));
    if (isAlreadyExists) {
      const existing = await this.findCustomerByEmail(email);
      if (existing) {
        this.logger.log(
          `Razorpay customer already exists for ${email}, using existing id ${existing.id}`,
        );
        return { id: existing.id };
      }
    }
    this.logger.error(
      `Razorpay create customer failed: ${res.status} ${errText}`,
    );
    throw new Error(`Razorpay create customer failed: ${res.status}`);
  }

  private async findCustomerByEmail(
    email: string,
  ): Promise<RazorpayCustomerResponse | null> {
    const auth = this.getAuth();
    const normalizedEmail = email.trim().toLowerCase();
    let skip = 0;
    const count = 100;
    for (let page = 0; page < 5; page++) {
      const res = await fetch(
        `https://api.razorpay.com/v1/customers?count=${count}&skip=${skip}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        },
      );
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as RazorpayFetchAllResponse;
      const items = data.items ?? [];
      const found = items.find(
        (c) => c.email?.trim().toLowerCase() === normalizedEmail,
      );
      if (found) return found;
      if (items.length < count) return null;
      skip += count;
    }
    return null;
  }
}
