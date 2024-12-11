import { ArxenaCandidateNode, ArxenaPersonNode, ArxenaJobCandidateNode } from '../types/candidate-sourcing-types';

export const mapArxCandidateToPersonNode = candidate => {
  const personNode: ArxenaPersonNode = {
    name: { firstName: candidate?.first_name || "", lastName: candidate?.last_name || ""},
    email: Array.isArray(candidate?.email_address) ? candidate?.email_address[0] : candidate?.email_address || "",
    linkedinLink: candidate?.linkedin_url ? { url: candidate?.linkedin_url, label: candidate?.linkedin_url } : { url: '', label: '' },
    phone: candidate?.phone_numbers && candidate?.phone_numbers?.length > 0 ? (typeof candidate?.phone_numbers[0] === 'string' ? candidate?.phone_numbers[0] : candidate?.phone_numbers[0]?.number) || "" : "",
    uniqueStringKey:candidate?.unique_key_string,
    jobTitle: candidate?.job_title || '',
  };
  return personNode;
};



export const mapArxCandidateToJobCandidateNode = candidate => {
  const jobCandidateNode: ArxenaJobCandidateNode = {
    name:  candidate.full_name,
    email: Array.isArray(candidate?.email_address) ? candidate?.email_address[0] : candidate?.email_address || "",
    profileUrl: {"label":candidate?.profile_url || "", "url":candidate?.profile_url || ""},
    // linkedinLink: candidate?.linkedin_url ? candidate?.linkedin_url : candidate?.linkedin_url || "",
    phone: candidate?.phone_numbers && candidate?.phone_numbers?.length > 0 ? (typeof candidate?.phone_numbers[0] === 'string' ? candidate?.phone_numbers[0] : candidate?.phone_numbers[0]?.number) || "" : "",
    uniqueStringKey:candidate?.unique_key_string,
    jsUserName: candidate?.jsUserName || '',
    jobTitle: candidate?.profile_title || '',
    profileTitle: candidate?.profile_title || '',
    // keySkills: candidate?.keySkills || "",
    // focusedSkills: candidate?.focusedSkills || "",
    currentLocation: candidate?.location_name || '',
    preferredLocations: candidate?.preferred_locations || "",

    birthDate: candidate?.birth_date,
    inferredSalary: candidate?.inferred_salary,
    inferredYearsExperience :candidate?.inferred_years_experience,
    noticePeriod: candidate?.notice_period,
    homeTown: candidate?.home_town,
    maritalStatus: candidate?.marital_status,
    ugInstituteName: candidate?.ug_institute_name,
    ugGraduationYear: candidate?.ug_graduation_year,
    pgGradudationDegree: candidate?.pg_graduation_degree,
    ugGraduationDegree: candidate?.ug_graduation_degree,
    pgGraduationYear: candidate?.pg_graduation_year,
    resumeHeadline: candidate?.resume_headline,
    keySkills: candidate?.key_skills,
    industry: candidate?.industry,
    modifyDateLabel: candidate?.modifyDateLabel || '',
    experienceYears: candidate?.experienceYears || "",
    experienceMonths: candidate?.experienceMonths || "",
    currentDesignation: candidate?.currentDesignation || '',
    currentOrganization: candidate?.job_company_name || '',
  };
  return jobCandidateNode;
};





export const mapArxCandidateToCandidateNode = (candidate, jobNode, jobSpecificNode) => {
  const candidateNode: ArxenaCandidateNode = {
    name: candidate?.first_name + ' ' + candidate?.last_name || "",
    jobsId: jobNode?.id,
    engagementStatus: false,
    startChat: false,
    uniqueStringKey:candidate?.unique_key_string,
    hiringNaukriUrl: {"label":candidate?.profile_url || '', "url":candidate?.profile_url || ''},
    stopChat: false,
    peopleId: '',
    jobSpecificFields: jobSpecificNode,
  };
  return candidateNode;
};



export const mapArxCandidateJobSpecificFields = candidate => {
  const jobSpecificFields = {
    profileTitle: candidate.profile_title,
    inferredSalary: candidate.inferred_salary,
    inferredYearsExperience: candidate.inferred_years_experience,
    inferredLocation: candidate.inferred_location,
    skills: candidate.skills,
    stdFunction: candidate.std_function,
    stdGrade: candidate.std_grade,
    stdFunctionRoot: candidate.std_function_root,
  };
  return jobSpecificFields;
};

export const processArxCandidate = (candidate, jobNode) => {
  // console.log("This is the job node", jobNode);
  const personNode = mapArxCandidateToPersonNode(candidate);
  const jobSpecificNode = mapArxCandidateJobSpecificFields(candidate);
  const candidateNode = mapArxCandidateToCandidateNode(candidate, jobNode, jobSpecificNode);
  const jobCandidateNode = mapArxCandidateToJobCandidateNode(candidate);
  return { personNode, candidateNode, jobCandidateNode };
};
