import { ArxenaCandidateNode, ArxenaPersonNode } from "twenty-shared";
import { normalizeLinkedInUrl } from './linkedin-url.utils';

export const mapArxCandidateToPersonNode = candidate => {
  const personNode: ArxenaPersonNode = {
    name: { firstName: candidate?.firstName || candidate?.first_name || "", lastName: candidate?.lastName || candidate?.last_name || ""},
    displayPicture: {"primaryLinkLabel":"Display Picture", "primaryLinkUrl":candidate?.displayPicture || candidate?.display_picture || ''},
    emails: Array.isArray(candidate?.emailAddress) ? {primaryEmail:candidate?.emailAddress[0]} : Array.isArray(candidate?.email_address) ? {primaryEmail:candidate?.email_address[0]} : {primaryEmail:candidate?.emailAddress || candidate?.email_address || ""},
    linkedinLink: candidate?.linkedinUrl ? { primaryLinkUrl: normalizeLinkedInUrl(candidate?.linkedinUrl), primaryLinkLabel: normalizeLinkedInUrl(candidate?.linkedinUrl) } : candidate?.linkedin_url ? { primaryLinkUrl: normalizeLinkedInUrl(candidate?.linkedin_url), primaryLinkLabel: normalizeLinkedInUrl(candidate?.linkedin_url) } : { primaryLinkUrl: '', primaryLinkLabel: '' },
    phones: { primaryPhoneNumber: candidate?.phoneNumbers && candidate?.phoneNumbers?.length > 0 ? (typeof candidate?.phoneNumbers[0] === 'string' ? candidate?.phoneNumbers[0] : candidate?.phoneNumbers[0]?.number) || "" : candidate?.phone_numbers && candidate?.phone_numbers?.length > 0 ? (typeof candidate?.phone_numbers[0] === 'string' ? candidate?.phone_numbers[0] : candidate?.phone_numbers[0]?.number) || "" : "" },
    uniqueStringKey : candidate?.uniqueStringKey || '',
    jobTitle: candidate?.jobTitle || '',
  };
  return personNode;
};


export const mapArxCandidateToCandidateNode = (candidate: {
  emailAddress?: any;
  phoneNumbers?: any;
  firstName?: string;
  lastName?: string;
  uniqueStringKey?: any;
  profileUrl?: any;
  displayPicture?: any;
  dataSource?: any;
  campaign?: any; 
  source?: any; 
  jobTitle?: string;
}, jobNode: { id: any; }, whatsapp_key: string) => {
  console.log('candidate:', candidate);
  console.log('whatsapp_key:', whatsapp_key);

  const dataSource = candidate?.dataSource || '';
  if (dataSource === 'linkedin') {
    whatsapp_key = 'linkedin';
  }
  else if (dataSource?.includes('naukri')) {
    whatsapp_key = whatsapp_key
  }
  
  // Get profile URL with proper null checking
  const profileUrl = candidate?.profileUrl || '';
  const firstName = candidate?.firstName || '';
  const lastName = candidate?.lastName || '';
  const phoneNumbers = candidate?.phoneNumbers || '';
  const emailAddress = candidate?.emailAddress || '';
  const displayPicture = candidate?.displayPicture || '';
  const uniqueStringKey = candidate?.uniqueStringKey || '';
  const jobTitle = candidate?.jobTitle || '';
  
  const candidateNode: ArxenaCandidateNode = {
    name: `${firstName} ${lastName}`.trim() || "",
    jobsId: jobNode?.id,
    engagementStatus: false,
    startChat: false,
    phoneNumber: { 
      primaryPhoneNumber: phoneNumbers && phoneNumbers?.length > 0 ? 
        (typeof phoneNumbers[0] === 'string' ? phoneNumbers[0] : phoneNumbers[0]?.number) || "" : "" 
    },
    email: { 
      primaryEmail: Array.isArray(emailAddress) ? emailAddress[0] : emailAddress || "" 
    },
    stopChat: false,
    startVideoInterviewChat: false,
    startMeetingSchedulingChat: false,
    uniqueStringKey: uniqueStringKey,
    hiringNaukriUrl: { 
        "primaryLinkLabel": profileUrl && profileUrl.includes('hiring') ? profileUrl : '', 
      "primaryLinkUrl": profileUrl && profileUrl.includes('hiring') ? profileUrl : '' 
    },
    resdexNaukriUrl: { 
      "primaryLinkLabel": profileUrl && profileUrl.includes('resdex') ? profileUrl : '', 
      "primaryLinkUrl": profileUrl && profileUrl.includes('resdex') ? profileUrl : '' 
    },

    displayPicture: { 
      "primaryLinkLabel": "Display Picture", 
      "primaryLinkUrl": displayPicture || '' 
    },
    linkedinUrl: { 
      "primaryLinkLabel": profileUrl && profileUrl.includes('linkedin') ? normalizeLinkedInUrl(profileUrl) : '', 
      "primaryLinkUrl": profileUrl && profileUrl.includes('linkedin') ? normalizeLinkedInUrl(profileUrl) : '' 
    },
    peopleId: '',
    campaign: candidate?.campaign || '',
    source: dataSource || '',
    messagingChannel: whatsapp_key,
    jobTitle: jobTitle || '',
  };
  console.log('This is the candidateNode:', candidateNode);
  return candidateNode;
};
export const generateCompleteMappings = async (rawCandidateData, jobNode) => {
  // First get the current mappings
  const { personNode, candidateNode } = await processArxCandidate(rawCandidateData, jobNode);
  console.log('This is the personNode:', personNode);
  console.log('This is the candidateNode:', candidateNode);
  // Extract the keys that are already mapped
  const personNodeKeys = Object.keys(personNode);
  const candidateNodeKeys = Object.keys(candidateNode);
  console.log('This is the personNodeKeys:', personNodeKeys);

  console.log('This is the candidateNodeKeys:', candidateNodeKeys);
  console.log('This is the rawCandidateData:', rawCandidateData);
  // Get all keys from the raw data
  const allDataKeys = Object.keys(rawCandidateData);
  // Identify unmapped keys
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

  console.log('This is the unmappedKeys:', unmappedKeys);

  const unmappedCandidateObject = unmappedKeys.map(key => {
    return {
      key,
      value: rawCandidateData[key]
    }
  })
  
  console.log('This is the unmappedCandidateObject:', unmappedCandidateObject);
  return {
    personNode: personNode,
    candidateNode: candidateNode,
    unmappedCandidateObject: unmappedCandidateObject
  };
};


export const processArxCandidate = async (candidate, jobNode, whatsapp_key = process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys') => {
  // console.log("This is the job node", jobNode);
  const personNode = mapArxCandidateToPersonNode(candidate);
  // console.log("This is the job specific node", jobSpecificNode);
  const candidateNode = mapArxCandidateToCandidateNode(candidate, jobNode, whatsapp_key);
  console.log("This is the candidate node", candidateNode);
  return { personNode, candidateNode };
};





export function transformFieldName(field: string): string {
  // Map of special field transformations based on the mapping functions
  const fieldMappings: Record<string, string> = {
      // From personNode mappings
      'first_name': 'firstName',
      'last_name': 'lastName',
      'display_picture': 'displayPicture',
      'email_address': 'emailAddress',
      'linkedin_url': 'linkedinUrl',
      'phone_numbers': 'phoneNumbers',
      'unique_key_string': 'uniqueStringKey',
      'job_title': 'jobTitle',
      'jobs_id': 'jobsId',
      'engagement_status': 'engagementStatus',
      'start_chat': 'startChat',
      'stop_chat': 'stopChat',
      'start_video_interview_chat': 'startVideoInterviewChat',
      'start_meeting_scheduling_chat': 'startMeetingSchedulingChat',
      'hiring_naukri_url': 'hiringNaukriUrl',
      'people_id': 'peopleId',
      'profile_url': 'profileUrl',
      'data_source': 'dataSource',
      'profile_picture': 'profilePicture',
      'linkedin_profile_id_url': 'linkedinProfileIdUrl',
      'recruiter_profile_url': 'recruiterProfileUrl',
      'public_linkedin_url': 'publicLinkedinUrl',
      'contact_email': 'contactEmail',
      'location_name': 'locationName',
      'profile_location': 'profileLocation',
      'profile_headline': 'profileHeadline',
      'notice_period': 'noticePeriod',
      'candidate_id': 'candidateId',
      'search_id': 'searchId',
      'recruiter_id': 'recruiterId',
      'connection_degree': 'connectionDegree',
      'profile_views': 'profileViews',
      'saved_date': 'savedDate',
      'contacted_date': 'contactedDate',
      'inferred_salary': 'inferredSalary',
      'inferred_years_experience': 'inferredYearsExperience',
      'birth_date': 'birthDate',
      'ug_graduation_year': 'ugGraduationYear',
      'pg_graduation_year': 'pgGraduationYear',
      'experience_years': 'experienceYears',
      'experience_months': 'experienceMonths',
      'job_process_events': 'jobProcessEvents',
      'creation_particulars': 'creationParticulars',
      'linkedin_summary': 'linkedinSummary',
      'linkedin_connections': 'linkedinConnections',
      'linkedin_recommendations': 'linkedinRecommendations',
      'linkedin_followers': 'linkedinFollowers',
      'last_activity': 'lastActivity',
      'linkedin_headline': 'linkedinHeadline',
      'linkedin_full_name': 'linkedinFullName',
      'linkedin_company_name': 'linkedinCompanyName',
      'linkedin_phone_number': 'linkedinPhoneNumber',
      'linkedin_email_id': 'linkedinEmailId',
      'linkedin_social_profile': 'linkedinSocialProfile',
      'linkedin_job_title': 'linkedinJobTitle',
      'linkedin_recruiter_profile': 'linkedinRecruiterProfile',
      'linkedin_public_profile': 'linkedinPublicProfile',
      'job_title_standardization': 'jobTitleStandardization',
      'resdex_profile_url': 'resdexProfileUrl',
      'naukri_profile_url': 'naukriProfileUrl',
      'rms_profile_url': 'rmsProfileUrl',
      'candidate_profile_url': 'candidateProfileUrl',
      'jobs_profile_url': 'jobsProfileUrl',
      'jobs_profile_url_location': 'jobsProfileUrlLocation',
      'is_profile_purchased': 'isProfilePurchased',
  };

  // Check if there's a special mapping
  if (fieldMappings[field]) {
      return fieldMappings[field];
  }

  // Convert to camelCase for any unmapped fields
  return field.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

export function transformFieldValue(field: string, value: any): any {
  const booleanFields = [
      'start_chat',
      'stop_chat',
      'start_video_interview_chat',
      'start_meeting_scheduling_chat',
      'engagement_status',
      'startChat',
      'stopChat',
      'startVideoInterviewChat',
      'startMeetingSchedulingChat',
      'isProfilePurchased',
      'engagementStatus'
  ];

  // Handle boolean fields first
  if (booleanFields.includes(field)) {
    console.log("This is the value", value, "field", field);
      if (value === true || value === 'true' || value === 'True' || value === 'TRUE') {
        return true;
      }
      if (value === '' || value === null || value === undefined || value === false || value.toLowerCase() === 'no') {
          return false;
      }
      if (value.toLowerCase() === 'yes') {
          return true;
      }
      console.log("This is the value", value);
      const booleanValue = Boolean(value)
      console.log("This is the vboolean alue", value);
      return booleanValue;
  }

  // Handle other field types
  switch (field) {
      case 'phone_numbers':
      case 'phoneNumbers':
          return Array.isArray(value) ? 
              (typeof value[0] === 'string' ? value[0] : value[0]?.number) || "" : 
              value?.toString() || "";
          
      case 'email_address':
      case 'emailAddress':
          return Array.isArray(value) ? value[0] : value;

      case 'linkedin_url':
      case 'linkedinUrl':
      case 'profile_url':
      case 'profileUrl':
      case 'hiring_naukri_url':
      case 'hiringNaukriUrl':
          return {
              label: value || '',
              url: value || ''
          };

      case 'display_picture':
      case 'displayPicture':
          return {
              label: "Display Picture",
              url: value || ''
          };

      case 'inferred_years_experience':
      case 'inferredYearsExperience':
      case 'notice_period':
      case 'noticePeriod':
      case 'birth_date':
      case 'birthDate':
          return value?.toString() || "";

      case 'age':
      case 'inferred_salary':
      case 'inferredSalary':
      case 'ug_graduation_year':
      case 'ugGraduationYear':
      case 'pg_graduation_year':
      case 'pgGraduationYear':
      case 'experience_years':
      case 'experienceYears':
      case 'experience_months':
      case 'experienceMonths':
          return value || 0;

      default:
          return value || "";
  }
}