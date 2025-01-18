import { ArxenaCandidateNode, ArxenaPersonNode, ArxenaJobCandidateNode } from '../types/candidate-sourcing-types';

export const mapArxCandidateToPersonNode = candidate => {
  const personNode: ArxenaPersonNode = {
    name: { firstName: candidate?.first_name || "", lastName: candidate?.last_name || ""},
    displayPicture: {"label":"Display Picture", "url":candidate?.display_picture || ''},
    email: Array.isArray(candidate?.email_address) ? candidate?.email_address[0] : candidate?.email_address || "",
    linkedinLink: candidate?.linkedin_url ? { url: candidate?.linkedin_url, label: candidate?.linkedin_url } : { url: '', label: '' },
    phone: candidate?.phone_numbers && candidate?.phone_numbers?.length > 0 ? (typeof candidate?.phone_numbers[0] === 'string' ? candidate?.phone_numbers[0] : candidate?.phone_numbers[0]?.number) || "" : "",
    uniqueStringKey:candidate?.unique_key_string,
    jobTitle: candidate?.job_title || '',
  };
  return personNode;
};
export const mapArxCandidateToJobCandidateNode = candidate => {

  const ansKeys = Object.keys(candidate).filter(key => key.startsWith('Ans'));
  const ansFields = ansKeys.reduce((acc, key) => {
    const camelCaseKey = key.replace(/[^a-zA-Z0-9\s]/g, '').replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => index === 0 ? match.toLowerCase() : match.toUpperCase()).replace(/\s+/g, '').slice(0, 25);
    acc[camelCaseKey] = candidate[key];
    return acc;
  }, {});

  const jobCandidateNode: ArxenaJobCandidateNode = {
    name:  candidate.full_name,
    email: Array.isArray(candidate?.email_address) ? candidate?.email_address[0] : candidate?.email_address || "",
    profileUrl: {"label":candidate?.profile_url || "", "url":candidate?.profile_url || ""},
    phone: candidate?.phone_numbers && candidate?.phone_numbers?.length > 0 ? (typeof candidate?.phone_numbers[0] === 'string' ? candidate?.phone_numbers[0] : candidate?.phone_numbers[0]?.number) || "" : "",
    uniqueStringKey:candidate?.unique_key_string,
    jobTitle: candidate?.job_title || '',
    profileTitle: candidate?.profile_title || '',
    currentLocation: candidate?.location_name || '',
    preferredLocations: candidate?.preferred_locations || "",
    displayPicture: {"label":"Display Picture", "url":candidate?.display_picture || ''},
    birthDate: candidate?.birth_date?.toString() || "",
    age: candidate?.age || 0,
    inferredSalary: candidate?.inferred_salary || 0,
    inferredYearsExperience :candidate?.inferred_years_experience.toString() || "",
    noticePeriod: candidate?.notice_period?.toString() || "",
    homeTown: candidate?.home_town  || '',
    gender: candidate.gender  || '',
    maritalStatus: candidate?.marital_status || '',
    ugInstituteName: candidate?.ug_institute_name || '',
    ugGraduationYear: candidate?.ug_graduation_year || 0,
    pgGradudationDegree: candidate?.pg_graduation_degree || '',
    ugGraduationDegree: candidate?.ug_graduation_degree || '',
    pgGraduationYear: candidate?.pg_graduation_year || 0,
    resumeHeadline: candidate?.resume_headline || '',
    keySkills: candidate?.key_skills || '',
    industry: candidate?.industry || '',
    modifyDateLabel: candidate?.modifyDateLabel || '',
    experienceYears: candidate?.experience_years || 0,
    experienceMonths: candidate?.experienceMonths || 0,
    currentOrganization: candidate?.job_company_name || '',
    ...ansFields
  };
  return jobCandidateNode;
};

export const mapArxCandidateToCandidateNode = (candidate: { first_name: string; last_name: string; unique_key_string: any; profile_url: any; display_picture: any; }, jobNode: { id: any; }, jobSpecificNode: { profileTitle: any; inferredSalary: any; inferredYearsExperience: any; inferredLocation: any; skills: any; stdFunction: any; stdGrade: any; stdFunctionRoot: any; }) => {
  const candidateNode: ArxenaCandidateNode = {
    name: candidate?.first_name + ' ' + candidate?.last_name || "",
    jobsId: jobNode?.id,
    engagementStatus: false,
    startChat: false,
    stopChat: false,
    startVideoInterviewChat: false,
    startMeetingSchedulingChat: false,
    uniqueStringKey:candidate?.unique_key_string,
    hiringNaukriUrl: {"label":candidate?.profile_url || '', "url":candidate?.profile_url || ''},
    displayPicture: {"label":"Display Picture", "url":candidate?.display_picture || ''},
    peopleId: '',
    jobSpecificFields: jobSpecificNode,
  };
  return candidateNode;
};





export const mapArxCandidateJobSpecificFields = candidate => {
  const jobSpecificFields = {
    profileTitle: candidate?.profile_title || '',
    inferredSalary: candidate?.inferred_salary || 0,
    inferredYearsExperience: candidate?.inferred_years_experience.toString() || '',
    inferredLocation: candidate?.inferred_location || '',
    skills: candidate?.skills || '',
    stdFunction: candidate?.std_function || '',
    stdGrade: candidate?.std_grade || '',
    stdFunctionRoot: candidate?.std_function_root || '',
  };
  return jobSpecificFields;
};

export const processArxCandidate = async (candidate, jobNode) => {
  // console.log("This is the job node", jobNode);
  const personNode = mapArxCandidateToPersonNode(candidate);
  // console.log("This is the person node", personNode);
  const jobSpecificNode = mapArxCandidateJobSpecificFields(candidate);
  // console.log("This is the job specific node", jobSpecificNode);
  const candidateNode = mapArxCandidateToCandidateNode(candidate, jobNode, jobSpecificNode);
  // console.log("This is the candidate node", candidateNode);
  const jobCandidateNode = mapArxCandidateToJobCandidateNode(candidate);
  // console.log("This is the job candidate node", jobCandidateNode);
  return { personNode, candidateNode, jobCandidateNode };
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

      // From jobCandidateNode mappings
      'profile_url': 'profileUrl',
      'profile_title': 'profileTitle',
      'location_name': 'currentLocation',
      'preferred_locations': 'preferredLocations',
      'birth_date': 'birthDate',
      'inferred_salary': 'inferredSalary',
      'inferred_years_experience': 'inferredYearsExperience',
      'notice_period': 'noticePeriod',
      'home_town': 'homeTown',
      'marital_status': 'maritalStatus',
      'ug_institute_name': 'ugInstituteName',
      'ug_graduation_year': 'ugGraduationYear',
      'pg_graduation_degree': 'pgGradudationDegree',
      'ug_graduation_degree': 'ugGraduationDegree',
      'pg_graduation_year': 'pgGraduationYear',
      'resume_headline': 'resumeHeadline',
      'key_skills': 'keySkills',
      'modify_date_label': 'modifyDateLabel',
      'experience_years': 'experienceYears',
      'experience_months': 'experienceMonths',
      'job_company_name': 'currentOrganization',

      // From candidateNode mappings
      'jobs_id': 'jobsId',
      'engagement_status': 'engagementStatus',
      'start_chat': 'startChat',
      'stop_chat': 'stopChat',
      'start_video_interview_chat': 'startVideoInterviewChat',
      'start_meeting_scheduling_chat': 'startMeetingSchedulingChat',
      'hiring_naukri_url': 'hiringNaukriUrl',
      'people_id': 'peopleId',

      // From jobSpecificFields mappings
      'inferred_location': 'inferredLocation',
      'std_function': 'stdFunction',
      'std_grade': 'stdGrade',
      'std_function_root': 'stdFunctionRoot'
  };

  // Check if there's a special mapping
  if (fieldMappings[field]) {
      return fieldMappings[field];
  }

  // Convert to camelCase for any unmapped fields
  return field.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

export function transformFieldValue(field: string, value: any): any {
  // Boolean fields that should convert empty strings to false
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
  ];

  // Handle boolean fields first
  if (booleanFields.includes(field)) {
      if (value === '' || value === null || value === undefined || value === false) {
          return false;
      }
      return Boolean(value);
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