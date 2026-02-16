import { ArxenaCandidateNode, ArxenaPersonNode } from "twenty-shared";
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

export const mapArxCandidateToPersonNode = (candidate: any) => {
  const firstName = candidate?.firstName  || "";
  const lastName = candidate?.lastName || "";
  
  // Extract display picture from job_process_events if available
  let displayPictureUrl = candidate?.displayPicture || candidate?.display_picture || '';
  if (!displayPictureUrl && candidate?.job_process_events) {
    const profilePictureEvent = candidate.job_process_events.find(event => event.type === 'profile_picture');
    if (profilePictureEvent) {
      displayPictureUrl = profilePictureEvent.value;
    }
  }
  
  // Initialize DataProcessingUtils for enhanced cleaning
  const dataProcessingUtils = new DataProcessingUtils();
  
  // Extract and parse email data using enhanced cleaning
  let emailData: EnhancedEmailsValue = { primaryEmail: '', additionalEmails: [] };
  if (candidate?.emailAddress) {
    emailData = dataProcessingUtils.parseEmails(candidate.emailAddress);
  } else if (candidate?.emailAddresses && candidate.emailAddresses.length > 0) {
    emailData = dataProcessingUtils.parseEmails(candidate.emailAddresses);
  } else if (candidate?.email_address) {
    emailData = dataProcessingUtils.parseEmails(candidate.email_address);
  } else if (candidate?.emails?.personal?.length > 0) {
    emailData = dataProcessingUtils.parseEmails(candidate.emails.personal);
  } else if (candidate?.emails?.work?.length > 0) {
    emailData = dataProcessingUtils.parseEmails(candidate.emails.work);
  }
  
  // Extract and parse phone data using enhanced cleaning
  let phoneData: EnhancedPhonesValue = { 
    primaryPhoneNumber: '', 
    primaryPhoneCountryCode: '', 
    primaryPhoneCallingCode: '', 
    additionalPhones: [] 
  };
  
  // Try different phone number field formats in order of preference
  if (candidate?.phoneNumbers && candidate.phoneNumbers.length > 0) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(candidate.phoneNumbers);
  } else if (candidate?.phone_numbers && candidate.phone_numbers.length > 0) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(candidate.phone_numbers);
  } else if (candidate?.phoneNumber) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(candidate.phoneNumber);
  } else if (candidate?.phone_number) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(candidate.phone_number);
  }
  
  // Extract LinkedIn URL
  let linkedinUrl = '';
  if (candidate?.linkedinUrl) {
    linkedinUrl = candidate.linkedinUrl;
  } else if (candidate?.profileUrl && candidate.profileUrl.includes('linkedin')) {
    linkedinUrl = candidate.profileUrl;
  }
  
  // Extract job title (current designation) and job name (applied position)
  let jobTitle = candidate?.jobTitle || candidate?.profileTitle || '';
  let jobName = candidate?.jobName || '';
  
  const personNode: ArxenaPersonNode & {
    emails: EnhancedEmailsValue;
    phones: EnhancedPhonesValue;
  } = {
    name: { firstName, lastName },
    displayPicture: {"primaryLinkLabel":"Display Picture", "primaryLinkUrl": displayPictureUrl},
    emails: {
      primaryEmail: emailData.primaryEmail,
      additionalEmails: emailData.additionalEmails
    },
    linkedinLink: linkedinUrl ? { primaryLinkUrl: normalizeLinkedInUrl(linkedinUrl), primaryLinkLabel: normalizeLinkedInUrl(linkedinUrl) } : { primaryLinkUrl: '', primaryLinkLabel: '' },
    phones: { 
      primaryPhoneNumber: phoneData.primaryPhoneNumber,
      primaryPhoneCountryCode: phoneData.primaryPhoneCountryCode,
      primaryPhoneCallingCode: phoneData.primaryPhoneCallingCode,
      additionalPhones: phoneData.additionalPhones
    },
    uniqueStringKey : candidate?.uniqueStringKey || '',
    jobTitle: jobTitle,
  };
  return personNode;
};

export const mapArxCandidateToCandidateNode = (candidate: {
  emailAddress?: any;
  emailAddresses?: any;
  phoneNumbers?: any;
  phoneNumber?: any;
  phone_numbers?: any;
  firstName?: string;
  lastName?: string;
  uniqueStringKey?: any;
  profileUrl?: any;
  displayPicture?: any;
  dataSource?: any;
  campaign?: any;
  source?: any;
  jobTitle?: string;
  profileTitle?: string;
  jobName?: string;
  jobCompanyName?: string;
  emails?: any;
  linkedinUrl?: string;
}, jobNode: { id: any }, whatsapp_key: string) => {
  const dataSource = candidate?.dataSource || '';
  // Use LinkedIn messaging channel for any LinkedIn-derived data source
  const isLinkedInSource = dataSource === 'linkedin' || dataSource === 'linkedin_premium' || dataSource === 'linkedin_search' ||
    (typeof dataSource === 'string' && dataSource.startsWith('linkedin_'));
  if (isLinkedInSource || candidate?.linkedinUrl?.includes('linkedin') || candidate?.profileUrl?.includes('linkedin')) {
    whatsapp_key = 'linkedin';
  }
  if (dataSource?.includes('naukri') || candidate?.profileUrl?.includes('naukri') ) {
    whatsapp_key = process.env.DEFAULT_WHATSAPP_CLIENT || 'whatsapp-unipile';
  }
  if (dataSource?.includes('whatsapp-unipile') ) {
    whatsapp_key = process.env.DEFAULT_WHATSAPP_CLIENT || 'whatsapp-unipile';
  }
  // Get profile URL with proper null checking
  const profileUrl = candidate?.profileUrl || '';
  const firstName = candidate?.firstName || '';
  const lastName = candidate?.lastName || '';
  const uniqueStringKey = candidate?.uniqueStringKey || '';
  
  // Initialize DataProcessingUtils for enhanced cleaning
  const dataProcessingUtils = new DataProcessingUtils();
  
  // Extract and parse email data using enhanced cleaning
  let emailData: EnhancedEmailsValue = { primaryEmail: '', additionalEmails: [] };
  if (candidate?.emailAddress) {
    emailData = dataProcessingUtils.parseEmails(candidate.emailAddress);
  } else if (candidate?.emailAddresses && candidate.emailAddresses.length > 0) {
    emailData = dataProcessingUtils.parseEmails(candidate.emailAddresses);
  } else if (candidate?.emails?.personal?.length > 0) {
    emailData = dataProcessingUtils.parseEmails(candidate.emails.personal);
  } else if (candidate?.emails?.work?.length > 0) {
    emailData = dataProcessingUtils.parseEmails(candidate.emails.work);
  }
  
  // Extract and parse phone data using enhanced cleaning
  let phoneData: EnhancedPhonesValue = { 
    primaryPhoneNumber: '', 
    primaryPhoneCountryCode: '', 
    primaryPhoneCallingCode: '', 
    additionalPhones: [] 
  };
  
  // Try different phone number field formats in order of preference
  if (candidate?.phoneNumbers && candidate.phoneNumbers.length > 0) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(candidate.phoneNumbers);
  } else if (candidate?.phone_numbers && candidate.phone_numbers.length > 0) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(candidate.phone_numbers);
  } else if (candidate?.phoneNumber) {
    phoneData = dataProcessingUtils.parsePhoneNumbers(candidate.phoneNumber);
  }
  
  // Extract display picture from job_process_events if available
  let displayPictureUrl = candidate?.displayPicture || '';
  // if (!displayPictureUrl && candidate?.job_process_events) {
  //   const profilePictureEvent = candidate.job_process_events.find(event => event.type === 'profile_picture');
  //   if (profilePictureEvent) {
  //     displayPictureUrl = profilePictureEvent.value;
  //   }
  // }
  
  // Extract hiring Naukri URL from candidate data
  let hiringNaukriUrl = '';
  if ((candidate as any)?.hiringNaukriUrl?.primaryLinkUrl) {
    hiringNaukriUrl = (candidate as any).hiringNaukriUrl.primaryLinkUrl;
  } else if ((candidate as any)?.hiringNaukriUrl) {
    hiringNaukriUrl = (candidate as any).hiringNaukriUrl;
  }
  
  // Extract LinkedIn URL
  let linkedinUrl = '';
  if (candidate?.linkedinUrl) {
    linkedinUrl = candidate.linkedinUrl;
  } else if (profileUrl && profileUrl.includes('linkedin')) {
    linkedinUrl = profileUrl;
  }
  
  // Extract job title (current designation) and job name (applied position)
  let jobTitle = candidate?.jobTitle || candidate?.profileTitle || '';
  let jobName = candidate?.jobName || '';
  let jobCompanyName = candidate?.jobCompanyName || ''; 

  const candidateNode: ArxenaCandidateNode & {
    phoneNumber: EnhancedPhonesValue;
    email: EnhancedEmailsValue;
  } = {
    name: `${firstName} ${lastName}`.trim() || "",
    jobsId: jobNode?.id,
    engagementStatus: false,
    startChat: false,
    phoneNumber: { 
      primaryPhoneNumber: phoneData.primaryPhoneNumber,
      primaryPhoneCountryCode: phoneData.primaryPhoneCountryCode,
      primaryPhoneCallingCode: phoneData.primaryPhoneCallingCode,
      additionalPhones: phoneData.additionalPhones
    },
    email: { 
      primaryEmail: emailData.primaryEmail,
      additionalEmails: emailData.additionalEmails
    },
    stopChat: false,
    startVideoInterviewChat: false,
    startMeetingSchedulingChat: false,
    uniqueStringKey: uniqueStringKey,
    hiringNaukriUrl: { 
        "primaryLinkLabel": hiringNaukriUrl || (profileUrl && profileUrl.includes('hiring') ? profileUrl : ''), 
      "primaryLinkUrl": hiringNaukriUrl || (profileUrl && profileUrl.includes('hiring') ? profileUrl : '')
    },
    resdexNaukriUrl: { 
      "primaryLinkLabel": profileUrl && profileUrl.includes('resdex') ? profileUrl : '', 
      "primaryLinkUrl": profileUrl && profileUrl.includes('resdex') ? profileUrl : '' 
    },

    displayPicture: { 
      "primaryLinkLabel": "Display Picture", 
      "primaryLinkUrl": displayPictureUrl
    },
    linkedinUrl: { 
      "primaryLinkLabel": linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : '', 
      "primaryLinkUrl": linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : ''
    },
    peopleId: '',
    campaign: candidate?.campaign || '',
    source: dataSource || '',
    messagingChannel: whatsapp_key,
    jobTitle: jobTitle,
    jobCompanyName: jobCompanyName,
  };
  return candidateNode;
};
export const generateCompleteMappings = async (rawCandidateData: any, jobNode: any) => {
  // First get the current mappings
  const { personNode, candidateNode } = await processArxCandidate(rawCandidateData, jobNode);
  const personNodeKeys = Object.keys(personNode || {});
  const candidateNodeKeys = Object.keys(candidateNode || {});

  const allDataKeys = Object.keys(rawCandidateData);
  const unmappedKeys = allDataKeys.filter(key => {
  const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());

    const isMappedInPerson = personNodeKeys.some(k => 
      k.toLowerCase() === key.toLowerCase() || 
      k.toLowerCase() === camelCaseKey.toLowerCase()
    );
    const isMappedInCandidate = candidateNodeKeys.some(k => 
      k.toLowerCase() === key.toLowerCase() || 
      k.toLowerCase() === camelCaseKey.toLowerCase()
    );
    
    return !isMappedInPerson && !isMappedInCandidate;
  });


  const unmappedCandidateObject = unmappedKeys.map(key => {
    return {
      key,
      value: rawCandidateData[key]
    }
  })
  
  return {
    personNode: personNode,
    candidateNode: candidateNode,
    unmappedCandidateObject: unmappedCandidateObject
  };
};


export const processArxCandidate = async (candidate: any, jobNode: any, whatsapp_key: string = process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys') => {
  const personNode = mapArxCandidateToPersonNode(candidate);
  const candidateNode = mapArxCandidateToCandidateNode(candidate, jobNode, whatsapp_key);
  return { personNode, candidateNode };
};

