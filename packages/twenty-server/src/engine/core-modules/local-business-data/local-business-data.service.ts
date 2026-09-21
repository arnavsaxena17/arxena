import { Injectable } from '@nestjs/common';

import { LocalBusinessDataClient } from 'src/engine/core-modules/local-business-data/local-business-data.client';
import {
  type LocalBusinessAutocompleteParams,
  type LocalBusinessDetailsParams,
  type LocalBusinessRecord,
  type LocalBusinessSearchInAreaParams,
  type LocalBusinessSearchNearbyParams,
  type LocalBusinessSearchParams,
} from 'src/engine/core-modules/local-business-data/types/local-business-data.types';

@Injectable()
export class LocalBusinessDataService {
  constructor(
    private readonly localBusinessDataClient: LocalBusinessDataClient,
  ) {}

  async search(
    params: LocalBusinessSearchParams,
  ): Promise<LocalBusinessRecord[]> {
    const data = await this.localBusinessDataClient.get<
      LocalBusinessRecord[] | LocalBusinessRecord
    >('/search', {
      query: params.query,
      limit: params.limit,
      lat: params.lat,
      lng: params.lng,
      zoom: params.zoom,
      language: params.language,
      region: params.region,
      extract_emails_and_contacts: params.extractEmailsAndContacts,
      subtypes: params.subtypes,
      verified: params.verified,
      business_status: params.businessStatus,
      fields: params.fields,
    });

    return this.asBusinessArray(data);
  }

  async searchNearby(
    params: LocalBusinessSearchNearbyParams,
  ): Promise<LocalBusinessRecord[]> {
    const data = await this.localBusinessDataClient.get<
      LocalBusinessRecord[] | LocalBusinessRecord
    >('/search-nearby', {
      query: params.query,
      lat: params.lat,
      lng: params.lng,
      limit: params.limit,
      language: params.language,
      region: params.region,
      extract_emails_and_contacts: params.extractEmailsAndContacts,
      subtypes: params.subtypes,
      verified: params.verified,
      business_status: params.businessStatus,
      fields: params.fields,
    });

    return this.asBusinessArray(data);
  }

  async searchInArea(
    params: LocalBusinessSearchInAreaParams,
  ): Promise<LocalBusinessRecord[]> {
    const data = await this.localBusinessDataClient.get<
      LocalBusinessRecord[] | LocalBusinessRecord
    >('/search-in-area', {
      query: params.query,
      lat: params.lat,
      lng: params.lng,
      zoom: params.zoom,
      limit: params.limit,
      language: params.language,
      region: params.region,
      extract_emails_and_contacts: params.extractEmailsAndContacts,
      subtypes: params.subtypes,
      verified: params.verified,
      business_status: params.businessStatus,
      fields: params.fields,
    });

    return this.asBusinessArray(data);
  }

  async getBusinessDetails(
    params: LocalBusinessDetailsParams,
  ): Promise<LocalBusinessRecord[]> {
    const businessIdParam = params.businessIds.join(',');
    const data = await this.localBusinessDataClient.get<
      LocalBusinessRecord[] | LocalBusinessRecord
    >('/business-details', {
      business_id: businessIdParam,
      extract_emails_and_contacts: params.extractEmailsAndContacts,
      extract_share_link: params.extractShareLink,
      language: params.language,
      region: params.region,
      fields: params.fields,
    });

    return this.asBusinessArray(data);
  }

  async autocomplete(
    params: LocalBusinessAutocompleteParams,
  ): Promise<unknown[]> {
    const data = await this.localBusinessDataClient.get<unknown[] | unknown>(
      '/autocomplete',
      {
        query: params.query,
        language: params.language,
        region: params.region,
      },
    );

    if (Array.isArray(data)) {
      return data;
    }

    if (data == null) {
      return [];
    }

    return [data];
  }

  private asBusinessArray(
    data: LocalBusinessRecord[] | LocalBusinessRecord,
  ): LocalBusinessRecord[] {
    if (Array.isArray(data)) {
      return data;
    }

    if (data == null) {
      return [];
    }

    return [data];
  }
}
