import { ArxenaCandidateNode, ArxenaPersonNode } from "twenty-shared";

export const mapArxCandidateToPersonNode = candidate => {
  const personNode: ArxenaPersonNode = {
    name: { firstName: candidate?.first_name || "", lastName: candidate?.last_name || ""},
    displayPicture: {"primaryLinkLabel":"Display Picture", "primaryLinkUrl":candidate?.display_picture || ''},
    emails: Array.isArray(candidate?.email_address) ? {primaryEmail:candidate?.email_address[0]} : {primaryEmail:candidate?.email_address || ""},
    linkedinLink: candidate?.linkedin_url ? { primaryLinkUrl: candidate?.linkedin_url, primaryLinkLabel: candidate?.linkedin_url } : { primaryLinkUrl: '', primaryLinkLabel: '' },
    phones: { primaryPhoneNumber: candidate?.phone_numbers && candidate?.phone_numbers?.length > 0 ? (typeof candidate?.phone_numbers[0] === 'string' ? candidate?.phone_numbers[0] : candidate?.phone_numbers[0]?.number) || "" : "" },
    uniqueStringKey:candidate?.unique_key_string,
    jobTitle: candidate?.job_title || '',
  };
  return personNode;
};


export const mapArxCandidateToCandidateNode = (candidate: {
  email_address: any;
  phone_numbers: any; first_name: string; last_name: string; unique_key_string: any; profile_url: any; display_picture: any; data_source: any; campaign: any; source: any;
}, jobNode: { id: any; }, whatsapp_key: string) => {

  console.log('whatsapp_key:', whatsapp_key);

  if (candidate?.data_source === 'linkedin') {
    whatsapp_key = 'linkedin';
  }
  else if (candidate?.data_source?.includes('naukri')) {
    whatsapp_key = whatsapp_key
  }
  
  const candidateNode: ArxenaCandidateNode = {
    name: candidate?.first_name + ' ' + candidate?.last_name || "",
    jobsId: jobNode?.id,
    engagementStatus: false,
    startChat: false,
    phoneNumber: { primaryPhoneNumber: candidate?.phone_numbers && candidate?.phone_numbers?.length > 0 ? (typeof candidate?.phone_numbers[0] === 'string' ? candidate?.phone_numbers[0] : candidate?.phone_numbers[0]?.number) || "" : "" },
    email: { primaryEmail: Array.isArray(candidate?.email_address) ? candidate?.email_address[0] : candidate?.email_address || "" },
    stopChat: false,
    startVideoInterviewChat: false,
    startMeetingSchedulingChat: false,
    uniqueStringKey: candidate?.unique_key_string,
    hiringNaukriUrl: { "primaryLinkLabel": candidate?.profile_url || '', "primaryLinkUrl": candidate?.profile_url || '' },
    resdexNaukriUrl: { "primaryLinkLabel": candidate?.profile_url || '', "primaryLinkUrl": candidate?.profile_url || '' },
    displayPicture: { "primaryLinkLabel": "Display Picture", "primaryLinkUrl": candidate?.display_picture || '' },
    linkedinUrl: { "primaryLinkLabel": candidate?.profile_url || '', "primaryLinkUrl": candidate?.profile_url || '' },
    peopleId: '',
    campaign: candidate?.campaign || '',
    source: candidate?.data_source || '',
    messagingChannel: whatsapp_key,
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
  console.log('This is the allDataKeys:', allDataKeys);
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


export const processArxCandidate = async (candidate, jobNode, whatsapp_key = 'whatsapp-web') => {
  // console.log("This is the job node", jobNode);
  const personNode = mapArxCandidateToPersonNode(candidate);
  // console.log("This is the job specific node", jobSpecificNode);
  const candidateNode = mapArxCandidateToCandidateNode(candidate, jobNode, whatsapp_key);
  // console.log("This is the candidate node", candidateNode);
  return { personNode, candidateNode };
};





export function transformFieldName(field: string): string {
  // Map of special field transformations based on the mapping functions
  const fieldMappings: Record<string, string> = {
      // From personNode mappings
      'first_name': 'firstName',
      'last_name': 'lastName',
      'display_picture': 'displayPicture',
      'email_address': 'email',
      'linkedin_url': 'linkedinLink',
      'phone_numbers': 'phone',
      'unique_key_string': 'uniqueStringKey',
      'job_title': 'jobTitle',


      // From candidateNode mappings
      'jobs_id': 'jobsId',
      'engagement_status': 'engagementStatus',
      'start_chat': 'startChat',
      'stop_chat': 'stopChat',
      'start_video_interview_chat': 'startVideoInterviewChat',
      'start_meeting_scheduling_chat': 'startMeetingSchedulingChat',
      'hiring_naukri_url': 'hiringNaukriUrl',
      'people_id': 'peopleId',


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
      'isProfilePurchased'
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
          return Array.isArray(value) ? 
              (typeof value[0] === 'string' ? value[0] : value[0]?.number) || "" : 
              value?.toString() || "";
          
      case 'email_address':
          return Array.isArray(value) ? value[0] : value;

      case 'linkedin_url':
      case 'profile_url':
      case 'hiring_naukri_url':
          return {
              label: value || '',
              url: value || ''
          };

      case 'display_picture':
          return {
              label: "Display Picture",
              url: value || ''
          };

      case 'inferred_years_experience':
      case 'notice_period':
      case 'birth_date':
          return value?.toString() || "";

      case 'age':
      case 'inferred_salary':
      case 'ug_graduation_year':
      case 'pg_graduation_year':
      case 'experience_years':
      case 'experience_months':
          return value || 0;

      default:
          return value || "";
  }
}