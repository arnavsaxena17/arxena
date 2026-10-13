import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';

const hasNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const toOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const toOptionalBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

export const localBusinessDataTools: McpTool[] = [
  {
    definition: {
      name: 'search_local_businesses',
      title: 'Search local businesses',
      description:
        'Search Google Maps local businesses / POIs (OpenWeb Ninja Local Business Data). Use for plumbers, hotels, restaurants, clinics, etc. Credits are charged per business returned.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Google Maps style query, e.g. "Hotels in San Francisco, USA"',
          },
          limit: {
            type: 'number',
            description: 'Max businesses to return (1-500, default 20)',
          },
          lat: { type: 'number', description: 'Optional latitude bias' },
          lng: { type: 'number', description: 'Optional longitude bias' },
          zoom: { type: 'number', description: 'Optional map zoom level' },
          language: {
            type: 'string',
            description: 'Language code (default en)',
          },
          region: { type: 'string', description: 'Region code (default us)' },
          extractEmailsAndContacts: {
            type: 'boolean',
            description:
              'If true, scrape emails/socials (extra credit per business with a website)',
          },
          verified: {
            type: 'boolean',
            description: 'Only verified businesses when true',
          },
          businessStatus: {
            type: 'string',
            description: 'Comma-separated OPEN,CLOSED_TEMPORARILY,CLOSED',
          },
          subtypes: {
            type: 'string',
            description: 'Optional subtype filter',
          },
        },
        required: ['query'],
      },
    },
    handler: async (args, config) => {
      if (!hasNonEmptyString(args.query)) {
        throw new Error('query is required');
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'local-business-data',
        'search',
        {
          query: args.query,
          limit: toOptionalNumber(args.limit),
          lat: toOptionalNumber(args.lat),
          lng: toOptionalNumber(args.lng),
          zoom: toOptionalNumber(args.zoom),
          language: hasNonEmptyString(args.language)
            ? args.language
            : undefined,
          region: hasNonEmptyString(args.region) ? args.region : undefined,
          extractEmailsAndContacts: toOptionalBoolean(
            args.extractEmailsAndContacts,
          ),
          verified: toOptionalBoolean(args.verified),
          businessStatus: hasNonEmptyString(args.businessStatus)
            ? args.businessStatus
            : undefined,
          subtypes: hasNonEmptyString(args.subtypes)
            ? args.subtypes
            : undefined,
        },
      );
    },
  },
  {
    definition: {
      name: 'search_local_businesses_nearby',
      title: 'Search local businesses nearby',
      description:
        'Search Google Maps businesses near a lat/lng coordinate (Search nearby). Requires query, lat, and lng.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Nearby search query, e.g. "coffee shops"',
          },
          lat: { type: 'number', description: 'Center latitude' },
          lng: { type: 'number', description: 'Center longitude' },
          limit: {
            type: 'number',
            description: 'Max businesses to return (1-500, default 20)',
          },
          language: {
            type: 'string',
            description: 'Language code (default en)',
          },
          region: { type: 'string', description: 'Region code (default us)' },
          extractEmailsAndContacts: {
            type: 'boolean',
            description: 'If true, scrape emails/socials (extra credits)',
          },
        },
        required: ['query', 'lat', 'lng'],
      },
    },
    handler: async (args, config) => {
      if (!hasNonEmptyString(args.query)) {
        throw new Error('query is required');
      }
      if (typeof args.lat !== 'number' || typeof args.lng !== 'number') {
        throw new Error('lat and lng are required numbers');
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'local-business-data',
        'search-nearby',
        {
          query: args.query,
          lat: args.lat,
          lng: args.lng,
          limit: toOptionalNumber(args.limit),
          language: hasNonEmptyString(args.language)
            ? args.language
            : undefined,
          region: hasNonEmptyString(args.region) ? args.region : undefined,
          extractEmailsAndContacts: toOptionalBoolean(
            args.extractEmailsAndContacts,
          ),
        },
      );
    },
  },
  {
    definition: {
      name: 'get_local_business_details',
      title: 'Get local business details',
      description:
        'Fetch full business details by business_id / google_id / place_id. Supports up to 20 ids. Set extractEmailsAndContacts for emails and social profiles.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          businessIds: {
            type: 'array',
            description: 'Array of business ids (max 20)',
            items: { type: 'string' },
          },
          extractEmailsAndContacts: {
            type: 'boolean',
            description: 'Extract emails and social contacts (default true)',
          },
          extractShareLink: {
            type: 'boolean',
            description: 'Extract share link when true',
          },
          language: {
            type: 'string',
            description: 'Language code (default en)',
          },
          region: { type: 'string', description: 'Region code (default us)' },
        },
        required: ['businessIds'],
      },
    },
    handler: async (args, config) => {
      const businessIds = Array.isArray(args.businessIds)
        ? args.businessIds.filter(hasNonEmptyString)
        : [];

      if (businessIds.length === 0) {
        throw new Error('businessIds must be a non-empty array of strings');
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'local-business-data',
        'business-details',
        {
          businessIds: businessIds.slice(0, 20),
          extractEmailsAndContacts:
            toOptionalBoolean(args.extractEmailsAndContacts) ?? true,
          extractShareLink: toOptionalBoolean(args.extractShareLink),
          language: hasNonEmptyString(args.language)
            ? args.language
            : undefined,
          region: hasNonEmptyString(args.region) ? args.region : undefined,
        },
      );
    },
  },
  {
    definition: {
      name: 'autocomplete_local_businesses',
      title: 'Autocomplete local businesses',
      description:
        'Google Maps style place/business/query autocomplete for geographic text. Prefer GeoMap/Google Places for CRM address fields; use this for local-business query suggestions.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Partial place / business / query text',
          },
          language: {
            type: 'string',
            description: 'Language code (default en)',
          },
          region: { type: 'string', description: 'Region code (default us)' },
        },
        required: ['query'],
      },
    },
    handler: async (args, config) => {
      if (!hasNonEmptyString(args.query)) {
        throw new Error('query is required');
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'local-business-data',
        'autocomplete',
        {
          query: args.query,
          language: hasNonEmptyString(args.language)
            ? args.language
            : undefined,
          region: hasNonEmptyString(args.region) ? args.region : undefined,
        },
      );
    },
  },
];
