import { isValidUuid } from 'twenty-shared/utils';
import { isNonEmptyString } from '@sniptt/guards';
import {
  type CandidateCreateInput,
  type PersonCreateInput,
} from 'twenty-shared';
import { normalizeMessagingChannel } from 'src/engine/core-modules/arx-chat/utils/messaging-channel.util';
import {
  extractDisplayPictureUrl,
  resolveAvatarUrlFromDisplayPictureUrl,
  toCrmPrimaryLink,
} from './avatar-url.util';
import { DataProcessingUtils } from './data-processing.utils';
import { normalizeLinkedInUrl } from './linkedin-url.utils';

// Define enhanced types that support additional phone and email fields
type EnhancedPhonesValue = {
  primaryPhoneNumber: string;
  primaryPhoneCountryCode: string;
  primaryPhoneCallingCode: string;
  additionalPhones: Array<{
    number: string;
    callingCode: string;
    countryCode: string;
  }>;
};

type EnhancedEmailsValue = {
  primaryEmail: string;
  additionalEmails: string[];
};

// Maps PersonCandidateDraft (ingest) → Person create payload. Identity never lands on Candidate.
export const mapArxCandidateToPersonNode = (draft: any) => {
  const firstName = draft?.firstName || '';
  const lastName = draft?.lastName || '';
  const displayPictureUrl = extractDisplayPictureUrl(
    draft as Record<string, unknown>,
  );
  const avatarUrl =
    (typeof draft?.avatarUrl === 'string' &&
      (draft.avatarUrl.startsWith('http://') ||
        draft.avatarUrl.startsWith('https://')) &&
      draft.avatarUrl.trim()) ||
    resolveAvatarUrlFromDisplayPictureUrl(displayPictureUrl);
  const displayPictureLink = toCrmPrimaryLink(
    displayPictureUrl,
    'Display Picture',
  );

  const dataProcessingUtils = new DataProcessingUtils();

  let emailData: EnhancedEmailsValue = {
    primaryEmail: '',
    additionalEmails: [],
  };
  const peopleEmails = draft?.people?.emails;
  const compositeEmails = draft?.emails;
  if (peopleEmails?.primaryEmail) {
    emailData = dataProcessingUtils.parseEmails(peopleEmails);
  } else if (compositeEmails?.primaryEmail) {
    emailData = dataProcessingUtils.parseEmails(compositeEmails);
  } else if (draft?.emailAddress) {
    emailData = dataProcessingUtils.parseEmails(draft.emailAddress);
  } else if (draft?.emailAddresses && draft.emailAddresses.length > 0) {
    emailData = dataProcessingUtils.parseEmails(draft.emailAddresses);
  } else if (draft?.email_address) {
    emailData = dataProcessingUtils.parseEmails(draft.email_address);
  } else if (compositeEmails?.personal?.length > 0) {
    emailData = dataProcessingUtils.parseEmails(compositeEmails.personal);
  } else if (compositeEmails?.work?.length > 0) {
    emailData = dataProcessingUtils.parseEmails(compositeEmails.work);
  }

  let phoneData: EnhancedPhonesValue = {
    primaryPhoneNumber: '',
    primaryPhoneCountryCode: '',
    primaryPhoneCallingCode: '',
    additionalPhones: [],
  };

  const peoplePhones = draft?.people?.phones;
  const compositePhones = draft?.phones;
  if (peoplePhones?.primaryPhoneNumber) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(peoplePhones);
  } else if (compositePhones?.primaryPhoneNumber) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(compositePhones);
  } else if (draft?.phoneNumbers && draft.phoneNumbers.length > 0) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(draft.phoneNumbers);
  } else if (draft?.phone_numbers && draft.phone_numbers.length > 0) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(draft.phone_numbers);
  } else if (draft?.phoneNumber) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(draft.phoneNumber);
  } else if (draft?.phone_number) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(draft.phone_number);
  }

  let linkedinUrl = '';
  if (typeof draft?.linkedinUrl === 'string') {
    linkedinUrl = draft.linkedinUrl;
  } else if (
    draft?.linkedinUrl &&
    typeof draft.linkedinUrl === 'object' &&
    typeof draft.linkedinUrl.primaryLinkUrl === 'string'
  ) {
    linkedinUrl = draft.linkedinUrl.primaryLinkUrl;
  } else if (draft?.profileUrl && draft.profileUrl.includes('linkedin')) {
    linkedinUrl = draft.profileUrl;
  }
  const linkedinLink = toCrmPrimaryLink(
    normalizeLinkedInUrl(linkedinUrl),
    normalizeLinkedInUrl(linkedinUrl),
  ) ?? { primaryLinkUrl: '', primaryLinkLabel: '' };

  const jobTitle = draft?.jobTitle || draft?.profileTitle || '';

  const personNode: PersonCreateInput & {
    emails: EnhancedEmailsValue;
    phones: EnhancedPhonesValue;
  } = {
    name: { firstName, lastName },
    ...(displayPictureLink ? { displayPicture: displayPictureLink } : {}),
    avatarUrl,
    emails: {
      primaryEmail: emailData.primaryEmail,
      additionalEmails: emailData.additionalEmails,
    },
    linkedinLink,
    phones: {
      primaryPhoneNumber: phoneData.primaryPhoneNumber,
      primaryPhoneCountryCode: phoneData.primaryPhoneCountryCode,
      primaryPhoneCallingCode: phoneData.primaryPhoneCallingCode,
      additionalPhones: phoneData.additionalPhones,
    },
    uniqueStringKey: draft?.uniqueStringKey || '',
    jobTitle: jobTitle,
    ...(isNonEmptyString(draft?.jobCompanyName)
      ? { jobCompanyName: draft.jobCompanyName.trim() }
      : isNonEmptyString(draft?.company)
        ? { jobCompanyName: String(draft.company).trim() }
        : {}),
    ...(isNonEmptyString(draft?.locationName)
      ? { locationName: draft.locationName.trim() }
      : isNonEmptyString(draft?.location)
        ? { locationName: String(draft.location).trim() }
        : {}),
    ...(isNonEmptyString(draft?.linkedinProfileId)
      ? { linkedinProfileId: draft.linkedinProfileId.trim() }
      : {}),
    ...(toCrmPrimaryLink(
      typeof draft?.hiringNaukriUrl === 'string'
        ? draft.hiringNaukriUrl
        : draft?.hiringNaukriUrl?.primaryLinkUrl,
      'Hiring Naukri',
    )
      ? {
          hiringNaukriUrl: toCrmPrimaryLink(
            typeof draft?.hiringNaukriUrl === 'string'
              ? draft.hiringNaukriUrl
              : draft?.hiringNaukriUrl?.primaryLinkUrl,
            'Hiring Naukri',
          ),
        }
      : {}),
    ...(toCrmPrimaryLink(
      typeof draft?.resdexNaukriUrl === 'string'
        ? draft.resdexNaukriUrl
        : draft?.resdexNaukriUrl?.primaryLinkUrl,
      'Resdex Naukri',
    )
      ? {
          resdexNaukriUrl: toCrmPrimaryLink(
            typeof draft?.resdexNaukriUrl === 'string'
              ? draft.resdexNaukriUrl
              : draft?.resdexNaukriUrl?.primaryLinkUrl,
            'Resdex Naukri',
          ),
        }
      : {}),
    ...(draft?.linkedinProfile != null
      ? { linkedinProfile: draft.linkedinProfile }
      : {}),
    ...(draft?.linkedinPosts != null
      ? { linkedinPosts: draft.linkedinPosts }
      : {}),
    ...(isNonEmptyString(draft?.outreachPreferredChannel)
      ? {
          outreachPreferredChannel: draft.outreachPreferredChannel.trim(),
        }
      : {}),
    ...(typeof draft?.companyId === 'string' &&
    isValidUuid(draft.companyId.trim())
      ? { companyId: draft.companyId.trim() }
      : typeof draft?.jobCompanyId === 'string' &&
          isValidUuid(draft.jobCompanyId.trim())
        ? { companyId: draft.jobCompanyId.trim() }
        : {}),
  };
  return personNode;
};

export const mapArxCandidateToCandidateNode = (
  draft: {
    firstName?: string;
    lastName?: string;
    profileUrl?: string;
    dataSource?: any;
    campaign?: any;
    source?: any;
    linkedinUrl?: string;
  },
  jobNode: { id: any },
  whatsapp_key: string,
) => {
  const dataSource = draft?.dataSource || '';
  // Use LinkedIn messaging channel for any LinkedIn-derived data source
  const isLinkedInSource =
    dataSource === 'linkedin' ||
    dataSource === 'linkedin_premium' ||
    dataSource === 'linkedin_search' ||
    (typeof dataSource === 'string' && dataSource.startsWith('linkedin_'));
  if (
    isLinkedInSource ||
    draft?.linkedinUrl?.includes('linkedin') ||
    draft?.profileUrl?.includes('linkedin')
  ) {
    whatsapp_key = 'linkedin';
  }
  if (dataSource?.includes('naukri') || draft?.profileUrl?.includes('naukri')) {
    whatsapp_key = process.env.DEFAULT_WHATSAPP_CLIENT || 'whatsapp-unipile';
  }
  if (dataSource?.includes('whatsapp-unipile')) {
    whatsapp_key = process.env.DEFAULT_WHATSAPP_CLIENT || 'whatsapp-unipile';
  }

  const firstName = draft?.firstName || '';
  const lastName = draft?.lastName || '';

  // Membership-only: identity is written to Person via mapArxCandidateToPersonNode
  const candidateNode: CandidateCreateInput = {
    name: `${firstName} ${lastName}`.trim() || '',
    projectId: jobNode?.id,
    candidateFlags: {
      engagementStatus: false,
      startChat: false,
      stopChat: false,
      startVideoInterviewChat: false,
      startMeetingSchedulingChat: false,
    },
    peopleId: '',
    campaign: draft?.campaign || '',
    source: dataSource || '',
    messagingChannel: normalizeMessagingChannel(whatsapp_key) ?? whatsapp_key,
  };
  return candidateNode;
};
export const generateCompleteMappings = async (
  rawCandidateData: any,
  jobNode: any,
) => {
  const { personNode, candidateNode } = await processArxCandidate(
    rawCandidateData,
    jobNode,
  );
  const personNodeKeys = Object.keys(personNode || {});
  const candidateNodeKeys = Object.keys(candidateNode || {});

  const allDataKeys = Object.keys(rawCandidateData);
  const unmappedKeys = allDataKeys.filter((key) => {
    const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) =>
      letter.toUpperCase(),
    );

    const isMappedInPerson = personNodeKeys.some(
      (mappedKey) =>
        mappedKey.toLowerCase() === key.toLowerCase() ||
        mappedKey.toLowerCase() === camelCaseKey.toLowerCase(),
    );
    const isMappedInCandidate = candidateNodeKeys.some(
      (mappedKey) =>
        mappedKey.toLowerCase() === key.toLowerCase() ||
        mappedKey.toLowerCase() === camelCaseKey.toLowerCase(),
    );

    return !isMappedInPerson && !isMappedInCandidate;
  });

  const unmappedCandidateObject = unmappedKeys.map((key) => {
    return {
      key,
      value: rawCandidateData[key],
    };
  });

  return {
    personNode: personNode,
    candidateNode: candidateNode,
    unmappedCandidateObject: unmappedCandidateObject,
  };
};

export const processArxCandidate = async (
  draft: any,
  jobNode: any,
  whatsapp_key: string = process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
) => {
  const personNode = mapArxCandidateToPersonNode(draft);
  const candidateNode = mapArxCandidateToCandidateNode(
    draft,
    jobNode,
    whatsapp_key,
  );
  return { personNode, candidateNode };
};
