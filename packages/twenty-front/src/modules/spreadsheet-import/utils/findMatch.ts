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
    fieldName: 'First Name (name)',
    alternativeHeaders: ['name', 'firstName', 'first_name', 'candidate', 'candidate name'],
  },
  {
    fieldName: 'Last Name (name)',
    alternativeHeaders: ['lastName', 'last_name', 'surname'],
  },
  {
    fieldName: 'Email (emails)',
    alternativeHeaders: ['email', 'emailAddress', 'email_address', 'primaryEmail', 'primary_email'],
  },
  {
    fieldName: 'Phone number (Phones)',
    alternativeHeaders: [
      'mobile',
      'cell',
      'telephone',
      'phoneNumber',
      'mobilePhone',
      'primaryPhoneNumber',
      'phone_number',
      'mobile_phone',
      'phone'
    ],
  },
  {
    fieldName: 'Phone country code (phones)',
    alternativeHeaders: ['countryCode', 'country_code', 'phoneCode', 'phone_code'],
  },
  {
    fieldName: 'company',
    alternativeHeaders: ['organization', 'business', 'employer', 'firm', 'companyName', 'company_name'],
  },
  {
    fieldName: 'jobTitle',
    alternativeHeaders: [
      'jobTitle',
      'job_title',
      'title',
      'position',
      'jobName',
      'job_name',
      'occupation',
      'role',
      'designation'
    ],
  },
  {
    fieldName: 'city',
    alternativeHeaders: ['location', 'locationName', 'location_name', 'town', 'locality', 'municipality'],
  },
  {
    fieldName: 'salary',
    alternativeHeaders: ['inferredSalary', 'inferred_salary', 'ctc', 'compensation', 'pay'],
  },
  {
    fieldName: 'Link URL (linkedinLink)',
    alternativeHeaders: ['linkedin', 'linkedinUrl', 'linkedin_url', 'linkedin profile', 'linkedin link'],
  },
  {
    fieldName: 'Link URL (xLink)',
    alternativeHeaders: ['twitter', 'x', 'twitterUrl', 'twitter_url', 'xUrl', 'x_url'],
  },
  {
    fieldName: 'Link URL (displayPicture)',
    alternativeHeaders: ['profilePicture', 'profile_picture', 'avatar', 'photo', 'picture'],
  },
  {
    fieldName: 'uniqueStringKey',
    alternativeHeaders: ['uniqueKeyString', 'unique_key_string', 'uniqueKey', 'unique_key', 'id'],
  },
  {
    fieldName: 'updatedAt',
    alternativeHeaders: ['lastUpdated', 'last_updated', 'updated', 'modified', 'lastModified'],
  },
  {
    fieldName: 'createdBy',
    alternativeHeaders: ['creator', 'created_by', 'author'],
  },
  {
    fieldName: 'deletedAt',
    alternativeHeaders: ['deleted', 'deleted_at', 'isDeleted', 'is_deleted'],
  },
  // Additional candidate-specific fields from fieldsData.ts
  {
    fieldName: 'status',
    alternativeHeaders: ['status', 'candidate_status', 'candidateStatus'],
  },
  {
    fieldName: 'candConversationStatus',
    alternativeHeaders: ['candConversationStatus', 'conversationStatus', 'conversation_status'],
  },
  {
    fieldName: 'remarks',
    alternativeHeaders: ['remarks', 'notes', 'comments', 'note'],
  },
  {
    fieldName: 'startChat',
    alternativeHeaders: ['startChat', 'start_chat', 'chatStarted', 'chat_started'],
  },
  {
    fieldName: 'startChatCompleted',
    alternativeHeaders: ['startChatCompleted', 'start_chat_completed', 'chatCompleted', 'chat_completed'],
  },
  {
    fieldName: 'stopChat',
    alternativeHeaders: ['stopChat', 'stop_chat', 'chatStopped', 'chat_stopped'],
  },
  {
    fieldName: 'source',
    alternativeHeaders: ['source', 'sourceChannel', 'source_channel', 'lead_source'],
  },
  {
    fieldName: 'messagingChannel',
    alternativeHeaders: ['messagingChannel', 'messaging_channel', 'channel', 'communication_channel'],
  },
  {
    fieldName: 'linkedinUrl',
    alternativeHeaders: ['linkedinUrl', 'linkedin_url', 'linkedinLink', 'linkedin_link'],
  },
  {
    fieldName: 'resdexNaukriUrl',
    alternativeHeaders: ['resdexNaukriUrl', 'resdex_naukri_url', 'resdexUrl', 'resdex_url'],
  },
  {
    fieldName: 'hiringNaukriUrl',
    alternativeHeaders: ['hiringNaukriUrl', 'hiring_naukri_url', 'naukriUrl', 'naukri_url'],
  },
  {
    fieldName: 'engagementStatus',
    alternativeHeaders: ['engagementStatus', 'engagement_status', 'isEngaged', 'is_engaged'],
  },
  {
    fieldName: 'whatsappProvider',
    alternativeHeaders: ['whatsappProvider', 'whatsapp_provider', 'provider'],
  },
  {
    fieldName: 'isProfilePurchased',
    alternativeHeaders: ['isProfilePurchased', 'is_profile_purchased', 'profilePurchased', 'profile_purchased'],
  },
  {
    fieldName: 'chatCount',
    alternativeHeaders: ['chatCount', 'chat_count', 'messageCount', 'message_count'],
  },
  {
    fieldName: 'campaign',
    alternativeHeaders: ['campaign', 'campaignName', 'campaign_name'],
  },
  {
    fieldName: 'jobCompanyName',
    alternativeHeaders: ['jobCompanyName', 'job_company_name', 'companyName', 'company_name'],
  },
  {
    fieldName: 'lastMessage',
    alternativeHeaders: ['lastMessage', 'last_message', 'recentMessage', 'recent_message'],
  },
  {
    fieldName: 'hasCv',
    alternativeHeaders: ['hasCv', 'has_cv', 'cvAvailable', 'cv_available', 'resumeAvailable', 'resume_available'],
  },
  {
    fieldName: 'name',
    alternativeHeaders: ['name', 'fullName', 'full_name', 'Full Name', 'full name' ],
  }
];
export const findMatch = <T extends string>(
  header: string,
  fields: Fields<T>,
  autoMapDistance: number,
): T | undefined => {
  console.log('findMatch called with header:', header, 'fields count:', fields.length);
  console.log('fields in findMatch::', fields);
  
  // Special handling: if header is phoneNumber but we're looking for phone-related fields,
  // be more careful about matching to country code fields
  const isPhoneNumberHeader = header.toLowerCase().includes('phone') || 
                              header.toLowerCase() === 'phonenumber' ||
                              header.toLowerCase() === 'mobile' ||
                              header.toLowerCase() === 'cell';
  // First check for exact matches in keys, labels, or alternateMatches
  for (const field of fields) {
    // console.log(
    //   'field::',
    //   field,
    //   'of fields::',
    //   fields,
    //   'with header::',
    //   header,
    // );
    
    // Special logic for phone number headers: prefer regular phone fields over country code fields
    if (isPhoneNumberHeader) {
      const isCountryCodeField = field.label && field.label.toLowerCase().includes('country code');
      const isRegularPhoneField = field.key.toLowerCase().includes('phone') && !isCountryCodeField;
      
      // If this is a country code field and we're matching a phoneNumber header, skip it
      if (isCountryCodeField) {
        console.log('Skipping country code field for phoneNumber header:', field.key, field.label);
        continue;
      }
    }
    
    // Check field key
    if (isExactMatch(field.key.toLowerCase(), header.toLowerCase())) {
      console.log('Exact match found for field key:', field.key, 'with header:', header);
      return field.key as T;
    }

    // Check field label
    if (isExactMatch(field.label.toLowerCase(), header.toLowerCase())) {
      console.log('Exact match found for field label:', field.label, 'with header:', header);
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
      // Skip country code fields for phone number headers
      if (isPhoneNumberHeader && staticAlternate.fieldName.toLowerCase().includes('country code')) {
        console.log('Skipping country code alternate match for phoneNumber header:', staticAlternate.fieldName);
        continue;
      }
      
      for (const alternate of staticAlternate.alternativeHeaders) {
        if (isExactMatch(alternate, header)) {
          console.log('Alternate match found for field:', field.key, 'with alternate:', alternate, 'and header:', header);
          return field.key as T;
        }
      }
    }
  }

  // If no exact match, fall back to Levenshtein distance
  const smallestValue = fields.reduce<AutoMatchAccumulator<T>>((acc, field) => {
    // Skip country code fields for phone number headers in Levenshtein matching too
    if (isPhoneNumberHeader) {
      const isCountryCodeField = field.label && field.label.toLowerCase().includes('country code');
      if (isCountryCodeField) {
        console.log('Skipping country code field in Levenshtein matching for phoneNumber header:', field.key, field.label);
        return acc;
      }
    }
    
    // Get static alternates for this field (if any)
    const staticAlternate = ALTERNATE_MATCHES.find(
      (match) => match.fieldName.toLowerCase() === field.key.toLowerCase(),
    );
    const staticAlternateHeaders = staticAlternate?.alternativeHeaders || [];

    // Calculate Levenshtein distance against key, label, and all alternate matches (case-insensitive)
    const distances = [
      lavenstein(field.key.toLowerCase(), header.toLowerCase()),
      lavenstein(field.label.toLowerCase(), header.toLowerCase()),
      ...(field.alternateMatches?.map((alternate) =>
        lavenstein(alternate.toLowerCase(), header.toLowerCase()),
      ) || []),
      // Add static alternates to distance calculations
      ...staticAlternateHeaders.map((alternate) =>
        lavenstein(alternate.toLowerCase(), header.toLowerCase()),
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
