import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { LocalBusinessDataService } from 'src/engine/core-modules/local-business-data/local-business-data.service';
import {
  SearchLocalBusinessesToolInputZodSchema,
  type SearchLocalBusinessesToolInput,
} from 'src/engine/core-modules/tool/tools/local-business-data-tool/types/search-local-businesses-tool-input.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class SearchLocalBusinessesTool implements Tool {
  private readonly logger = new Logger(SearchLocalBusinessesTool.name);

  constructor(
    private readonly localBusinessDataService: LocalBusinessDataService,
  ) {}

  description =
    'Search Google Maps local businesses / POIs via OpenWeb Ninja Local Business Data. Supports default search, search-nearby, and search-in-area.';
  inputSchema = SearchLocalBusinessesToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed =
      SearchLocalBusinessesToolInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Failed to search local businesses',
        error: parsed.error.message,
      };
    }

    const input = parsed.data;

    if (!isNonEmptyString(input.query)) {
      return {
        success: false,
        message: 'Failed to search local businesses',
        error: 'query is required',
      };
    }

    const mode = input.mode ?? 'search';

    if (
      (mode === 'search-nearby' || mode === 'search-in-area') &&
      (input.lat == null || input.lng == null)
    ) {
      return {
        success: false,
        message: 'Failed to search local businesses',
        error: 'lat and lng are required for nearby / in-area search',
      };
    }

    try {
      const businesses = await this.runSearch(input, mode);

      return {
        success: true,
        message: `Found ${businesses.length} local businesses`,
        result: {
          businesses,
          count: businesses.length,
          mode,
          query: input.query,
        },
      };
    } catch (error) {
      this.logger.error('Search local businesses failed', error);

      return {
        success: false,
        message: 'Failed to search local businesses',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private runSearch(
    input: SearchLocalBusinessesToolInput,
    mode: SearchLocalBusinessesToolInput['mode'],
  ) {
    const common = {
      query: input.query,
      limit: input.limit,
      language: input.language,
      region: input.region,
      extractEmailsAndContacts: input.extractEmailsAndContacts,
      subtypes: input.subtypes,
      verified: input.verified,
      businessStatus: input.businessStatus,
      fields: input.fields,
    };

    if (mode === 'search-nearby') {
      return this.localBusinessDataService.searchNearby({
        ...common,
        lat: input.lat as number,
        lng: input.lng as number,
      });
    }

    if (mode === 'search-in-area') {
      return this.localBusinessDataService.searchInArea({
        ...common,
        lat: input.lat as number,
        lng: input.lng as number,
        zoom: input.zoom,
      });
    }

    return this.localBusinessDataService.search({
      ...common,
      lat: input.lat,
      lng: input.lng,
      zoom: input.zoom,
    });
  }
}
