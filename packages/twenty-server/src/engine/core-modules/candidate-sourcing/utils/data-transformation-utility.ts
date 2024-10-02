import { ArxenaCandidateNode, ArxenaPersonNode } from '../types/candidate-sourcing-types';

export const mapArxCandidateToPersonNode = candidate => {
  const personNode: ArxenaPersonNode = {
    name: {
      firstName: candidate.first_name,
      lastName: candidate.last_name,
    },
    email: Array.isArray(candidate.email_address) 
      ? candidate.email_address[0] 
      : candidate.email_address || null,
    phone: candidate.phone_numbers && candidate.phone_numbers.length > 0
      ? (typeof candidate.phone_numbers[0] === 'string' 
        ? candidate.phone_numbers[0] 
        : candidate.phone_numbers[0]?.number) || null
      : null,
    jobTitle: candidate.job_title || 'Unknown', // Provide a default value if null or undefined
  };
  return personNode;
};





export const mapArxCandidateToCandidateNode = (candidate, jobNode, jobSpecificNode) => {
  const candidateNode: ArxenaCandidateNode = {
    name: candidate.first_name + ' ' + candidate.last_name,
    jobsId: jobNode.id,
    engagementStatus: false,
    startChat: false,
    stopChat: false,
    peopleId: '',
    // phoneNumber: candidate.phone_numbers[0],
    // email: candidate.email_address[0],
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
  const personNode = mapArxCandidateToPersonNode(candidate);
  const jobSpecificNode = mapArxCandidateJobSpecificFields(candidate);
  const candidateNode = mapArxCandidateToCandidateNode(candidate, jobNode, jobSpecificNode);

  return { personNode, candidateNode };
};
