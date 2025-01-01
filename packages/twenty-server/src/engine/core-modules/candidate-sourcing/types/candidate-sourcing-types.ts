interface Name {
  firstName: string | null;
  lastName: string | null;
}

interface Industry {
  name: string | null;
  is_primary: boolean | null;
}

interface Profile {
  title: string;
  network: string;
  username: string;
  is_primary: boolean;
  url: string;
}

interface Application {
  job_ids: string;
  job_name: string;
  user_id: string;
  current_status: string;
  timestamp: string;
  job_board: string;
  job_application_date: string | null;
}

interface Location {
  name: string;
  locality: string | null;
  region: string | null;
  subregion: string | null;
  country: string | null;
  continent: string | null;
  type: string | null;
  geo: string | null;
  postal_code: string | null;
  zip_plus_4: string | null;
  street_address: string | null;
  address_line_2: string | null;
  most_recent: boolean | null;
  is_primary: boolean;
  last_updated: string | null;
  preferred_location?: string | null;
}

interface ExperienceTitle {
  name: string;
}

interface ExperienceCompany {
  name: string;
}

interface Experience {
  title: ExperienceTitle;
  company: ExperienceCompany;
}

interface TotalYearsExperience {
  years: number | null;
  months: number | null;
}

interface CurrentSalary {
  type: string | null;
  ctc: number | null;
}

interface ExperienceStats {
  total_years_experience: TotalYearsExperience;
  current_salary: CurrentSalary;
}

interface Institute {
  name: string | null;
  type: string | null;
  location: string | null;
  profiles: string[];
  website: string | null;
}

interface Education {
  institute: Institute;
  end_date: string | null;
  start_date: string | null;
  gpa: number | null;
  degrees: string | null;
  majors: string[];
  minors: string[];
  locations: string | null;
}

interface SocialProfiles {
  linkedin: string;
}

export interface UserProfile {
  names: Name;
  id: string | null;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  middle_initial: string | null;
  full_name: string;
  job_company_name: string;
  job_company_id: string | null;
  location_name: string;
  job_company_linkedin_url: string | null;
  job_company_website: string | null;
  location_region: string | null;
  location_locality: string | null;
  location_metro: string | null;
  linkedin_url: string;
  facebook_url: string | null;
  twitter_url: string | null;
  location_country: string | null;
  profile_title: string;
  inferred_salary: string | null;
  inferred_years_experience: string | null;
  industry: string | null;
  country: string | null;
  birth_date_fuzzy: string | null;
  birth_date: string | null;
  gender: string | null;
  email_address: string[];
  emails: {
    work: string[];
    personal: string[];
    others: string[];
  };
  industries: Industry[];
  profiles: Profile[];
  phone_numbers: string[];
  phone_number: string;
  job_process: {
    applications: Application[];
  };
  locations: Location[];
  experience: Experience[];
  experience_stats: ExperienceStats;
  last_seen: {
    source: string | null;
    timestamp: string | null;
  };
  last_updated: string;
  education: Education[];
  interests: string[];
  skills: string | null;
  std_last_updated: string | null;
  created: number;
  creation_source: string;
  data_sources: string[];
  queryId: string[];
  job_name: string;
  data_source: string;
  upload_count: number;
  upload_id: string;
  profile_url: string;
  job_title: string;
  unique_key_string: string;
  tables: string[];
  socialprofiles: SocialProfiles;
  std_function: string;
  std_grade: string;
  std_function_root: string;
}


interface Profile {
  names: {
    first_name: string;
    last_name: string;
  };
  linkedin_url: string;
  profile_title: string;
}

// Define the oneCandidateObject interface
interface Candidate {
  name: string;
  personId: string;
  status: string;
  engagementStatus: boolean;
  startChat: boolean;
  whatsappProvider: string;
}

// Define the onePersonObject interface
interface Person {
  //   id: string;
  name: {
    firstName: string;
    lastName: string;
  };
  linkedinLink: {
    url: string;
  };
  jobTitle: string;
}

export interface ArxenaCandidateNode {
  name: string;
  engagementStatus: boolean;
  startChat: boolean;
  startVideoInterviewChat: boolean;
  startMeetingSchedulingChat: boolean;
  uniqueStringKey: string;
  stopChat: boolean;
  hiringNaukriUrl?: {label:string, url:string};
  resdexNaukriUrl?: {label:string, url:string};
  displayPicture: {label:string, url:string};
  jobsId: string;
  jobSpecificFields: any;
  personId: string;
}

export interface ArxenaJobCandidateNode {
  id?: string;
  profileUrl:{label:string, url:string};
  displayPicture:{label:string, url:string};
  educationUgYear?: number;
  educationUgSpecialization?: string;
  educationUgCourse?: string;
  birthDate?: string;
  age?: number;

  inferredSalary?: number;
  gender?: string;
  inferredYearsExperience?: string;
  homeTown?: string;

  ugInstituteName: string;
  ugGraduationYear: number;
  pgGradudationDegree: string;
  ugGraduationDegree: string;
  pgGraduationYear: number;
  resumeHeadline: string;
  industry: string;
  maritalStatus?: string;
  educationUgInstitute?: string;
  profileTitle: string;
  name?: string;
  linkedinLink?: string;
  email?: string;
  uniqueStringKey?: string;
  phone?: string;
  jobTitle?: string;
  jsUserName?: string;
  keySkills?: string;
  focusedSkills?: string;
  currentLocation?: string;
  preferredLocations?: string;
  noticePeriod?: string;
  modifyDateLabel?: string;
  experienceYears?: string;
  experienceMonths?: number;
  currentDesignation?: string;
  currentOrganization?: string;
  previousDesignation?: string;
  previousOrganization?: string;
  personId?: string;
  jobId?: string;
  candidateId?: string;
}
export interface ArxenaPersonNode {
  id?: any;
  educationUgYear?: number;
  educationUgSpecialization?: string;
  educationUgCourse?: string;
  educationUgInstitute?: string;
  employmentPreviousDesignation?: string;
  employmentCurrentOrganization?: string;
  employmentCurrentDesignation?: string;
  name?: {
    firstName: string;
    lastName: string;
  };
  linkedinLink?: {
    url: string;
    label: string;
  };
  displayPicture?: { url: string; label: string; };
  email?: string | null;
  uniqueStringKey?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  jsUserName?: string;
  keySkills?: string;
  focusedSkills?: string;
  currentLocation?: string;
  preferredLocations?: string;
  noticePeriod?: string;
  modifyDateLabel?: string;
  experienceYears?: number;
  experienceMonths?: number;
  currentDesignation?: string;
  currentOrganization?: string;
  previousDesignation?: string;
  previousOrganization?: string;
  ugInstitute?: string;
  ugCourse?: string;
  ugSpecialization?: string;
  ugYear?: number;
  pgInstitute?: string;
  pgCourse?: string;
  pgSpecialization?: string;
  pgYear?: number;
  ctcLacs?: number;
  ctcThousands?: number;
  ctcCurrency?: string;
  phoneNumberPresent?: boolean;
  mobileNumberPresent?: boolean;
  emailVerified?: boolean;
  cvAttached?: boolean;
  salaryDisclosed?: boolean;
  jsUserId?: string;
  jsResId?: string;
  personId?: string;
  jobId?: string;
  candidateId?: string;
}

export interface Jobs {
  name: string;
  id: string;
  recruiterId: string;
  jobLocation?: string;
  arxenaSiteId?: string;
}
