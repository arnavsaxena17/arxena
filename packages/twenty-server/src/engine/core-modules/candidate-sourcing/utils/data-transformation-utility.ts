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
  console.log("Ans keys:", ansKeys)
  const ansFields = ansKeys.reduce((acc, key) => {
    const camelCaseKey = key.replace(/[^a-zA-Z0-9\s]/g, '').replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => index === 0 ? match.toLowerCase() : match.toUpperCase()).replace(/\s+/g, '').slice(0, 50);
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
    experienceMonths: candidate?.experienceMonths || "",
    currentOrganization: candidate?.job_company_name || '',
    ...ansFields
  };
  return jobCandidateNode;
};

export const mapArxCandidateToCandidateNode = (candidate, jobNode, jobSpecificNode) => {
  const candidateNode: ArxenaCandidateNode = {
    name: candidate?.first_name + ' ' + candidate?.last_name || "",
    jobsId: jobNode?.id,
    engagementStatus: false,
    startChat: false,
    startVideoInterviewChat: false,
    startMeetingSchedulingChat: false,
    uniqueStringKey:candidate?.unique_key_string,
    hiringNaukriUrl: {"label":candidate?.profile_url || '', "url":candidate?.profile_url || ''},
    displayPicture: {"label":"Display Picture", "url":candidate?.display_picture || ''},
    stopChat: false,
    personId: '',
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
  console.log("This is the person node", personNode);
  const jobSpecificNode = mapArxCandidateJobSpecificFields(candidate);
  console.log("This is the job specific node", jobSpecificNode);
  const candidateNode = mapArxCandidateToCandidateNode(candidate, jobNode, jobSpecificNode);
  console.log("This is the candidate node", candidateNode);
  const jobCandidateNode = mapArxCandidateToJobCandidateNode(candidate);
  console.log("This is the job candidate node", jobCandidateNode);
  return { personNode, candidateNode, jobCandidateNode };
};
