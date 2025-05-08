import lavenstein from 'js-levenshtein';

import { Fields } from '@/spreadsheet-import/types';
import { isDefined } from 'twenty-shared';

type AutoMatchAccumulator<T> = {
  distance: number;
  value: T;
};

// Helper for exact string matching (case-insensitive)
const isExactMatch = (a: string, b: string): boolean => {
  return a.toLowerCase().trim() === b.toLowerCase().trim();
};

export type AlternateMatch = {
  fieldName: string;
  alternativeHeaders: string[];
};

export const ALTERNATE_MATCHES: AlternateMatch[] = [
  {
    fieldName: 'Name',
    alternativeHeaders: ['Candidate Name', 'candidate'],
  },
  {
    fieldName: 'Email (email)',
    alternativeHeaders: ['Email', 'email PrimaryEmail', 'PrimaryEmail', 'email PrimaryEmail', 'email primaryEmail'],
  },
  {
    fieldName: 'Phone number (phoneNumber)',
    alternativeHeaders: [
      'mobile',
      'phone',
      'cell',
      'telephone',
      'phone number',
      'work phone',
      'cell phone',
      'phoneNumber PrimaryPhoneNumber',
      'primaryPhoneNumber'
    ],
  },
  {
    fieldName: 'company',
    alternativeHeaders: ['organization', 'business', 'employer', 'firm'],
  },
  {
    fieldName: 'Jobs (ID)',
    alternativeHeaders: [
      'Posting Title',
      'Job Title',
      'Job Position',
      'Job',
      'Occupation',
    ],
  },
  {
    fieldName: 'city',
    alternativeHeaders: ['town', 'locality', 'municipality'],
  },
  {
    fieldName: 'country',
    alternativeHeaders: ['nation', 'state', 'location'],
  },
  {
    fieldName: 'linkedin',
    alternativeHeaders: ['linkedin url', 'linkedin profile', 'linkedin link'],
  },
  {
    fieldName: 'twitter',
    alternativeHeaders: [
      'twitter handle',
      'twitter account',
      'twitter username',
    ],
  },
  {
    fieldName: 'website',
    alternativeHeaders: ['site', 'web address', 'web page', 'homepage', 'url'],
  },
  {
    fieldName: 'address',
    alternativeHeaders: ['street address', 'mailing address', 'location'],
  },
  {
    fieldName: 'notes',
    alternativeHeaders: [
      'comment',
      'description',
      'memo',
      'details',
      'additional information',
    ],
  },
];
export const findMatch = <T extends string>(
  header: string,
  fields: Fields<T>,
  autoMapDistance: number,
): T | undefined => {
  // First check for exact matches in keys, labels, or alternateMatches
  for (const field of fields) {
    console.log(
      'field::',
      field,
      'of fields::',
      fields,
      'with header::',
      header,
    );
    // Check field key
    if (isExactMatch(field.key.toLowerCase(), header.toLowerCase())) {
      return field.key as T;
    }

    // Check field label
    if (isExactMatch(field.label.toLowerCase(), header.toLowerCase())) {
      return field.key as T;
    }

    // Check alternate matches from field
    if (isDefined(field.alternateMatches)) {
      for (const alternate of field.alternateMatches) {
        if (isExactMatch(alternate.toLowerCase(), header.toLowerCase())) {
          return field.key as T;
        }
      }
    }

    // Check alternate matches from static mapping
    const staticAlternate = ALTERNATE_MATCHES.find(
      (match) =>
        match.fieldName.toLowerCase() === field.key.toLowerCase() ||
        match.fieldName.toLowerCase() === field.label.toLowerCase(),
    );
    // const staticAlternate = ALTERNATE_MATCHES.find(
    //   (match) => match.fieldName.toLowerCase() === field.key.toLowerCase(),
    // );

    if (isDefined(staticAlternate)) {
      for (const alternate of staticAlternate.alternativeHeaders) {
        if (isExactMatch(alternate.toLowerCase(), header.toLowerCase())) {
          return field.key as T;
        }
      }
    }
  }

  // If no exact match, fall back to Levenshtein distance
  const smallestValue = fields.reduce<AutoMatchAccumulator<T>>((acc, field) => {
    // Get static alternates for this field (if any)
    const staticAlternate = ALTERNATE_MATCHES.find(
      (match) => match.fieldName.toLowerCase() === field.key.toLowerCase(),
    );
    const staticAlternateHeaders = staticAlternate?.alternativeHeaders || [];

    // Calculate Levenshtein distance against key, label, and all alternate matches
    const distances = [
      lavenstein(field.key, header),
      lavenstein(field.label, header),
      ...(field.alternateMatches?.map((alternate) =>
        lavenstein(alternate, header),
      ) || []),
      // Add static alternates to distance calculations
      ...staticAlternateHeaders.map((alternate) =>
        lavenstein(alternate, header),
      ),
    ];

    // Use the minimum distance
    const distance = Math.min(...distances);

    return distance < acc.distance || acc.distance === undefined
      ? ({ value: field.key, distance } as AutoMatchAccumulator<T>)
      : acc;
  }, {} as AutoMatchAccumulator<T>);

  return smallestValue.distance <= autoMapDistance
    ? smallestValue.value
    : undefined;
};
