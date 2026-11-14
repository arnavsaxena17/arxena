import { Injectable } from '@nestjs/common';

import type { JobSearchHit } from '../jobs-api.types';

const readString = (item: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const readCompanyName = (item: Record<string, unknown>): string => {
  const company = item.company;
  if (typeof company === 'string') {
    return company.trim();
  }
  if (company && typeof company === 'object') {
    return readString(company as Record<string, unknown>, ['name', 'title']);
  }

  return readString(item, ['companyName', 'company_name']);
};

@Injectable()
export class JobSearchHitTransformer {
  fromUnipileItem(item: Record<string, unknown>): JobSearchHit {
    return {
      id: readString(item, ['id', 'reference_id']),
      title: readString(item, ['title']),
      location: readString(item, ['location']),
      url: readString(item, ['url']),
      companyName: readCompanyName(item),
      postedAt: readString(item, ['posted_at', 'postedAt']),
    };
  }

  fromHarvestItem(item: Record<string, unknown>): JobSearchHit {
    return {
      id: readString(item, ['id']),
      title: readString(item, ['title', 'jobTitle']),
      location: readString(item, ['location']),
      url: readString(item, ['url', 'linkedinUrl', 'jobUrl']),
      companyName: readCompanyName(item),
      postedAt: readString(item, ['postedAt', 'postedDate', 'listedAt']),
    };
  }
}
