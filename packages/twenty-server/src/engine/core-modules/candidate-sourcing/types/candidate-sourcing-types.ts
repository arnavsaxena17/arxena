export interface Name {
  firstName: string | null;
  lastName: string | null;
}

export interface Industry {
  name: string | null;
  is_primary: boolean | null;
}

// Type definitions
export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other',
  NA = 'NA',
}

export enum MaritalStatus {
  MARRIED = 'Married',
  SINGLE = 'Single',
  SINGLE_UNMARRIED = 'Single/unmarried',

  NA = 'NA',
}

export enum NoticeStatus {
  IMMEDIATE = '15 Days or less',
  ONE_MONTH = '1 Months',
  TWO_MONTHS = '2 Months',
  THREE_MONTHS = '3 Months',
  SERVING = 'Serving Notice Period',
  NA = 'NA',
}

export interface ColumnDefinition {
  key: string;
  header: string;
  type: 'string' | 'number' | 'date' | 'enum' | 'boolean' | 'array' | 'url';
  enum?: any;
  format?: (value: any) => string;
}
export interface ProcessCandidatesJobData {
  data: UserProfile[];
  jobId: string;
  jobName: any;
  timestamp: any;
  apiToken: any;
}

export const columnDefinitions: ColumnDefinition[] = [
  {
    key: 'full_name',
    header: 'Candidate Name',
    type: 'string',
    format: (value: string) => value?.trim() || '',
  },
  {
    key: 'email_address',
    header: 'Email',
    type: 'array',
    format: (value: string[]) => (Array.isArray(value) ? value[0] || '' : value || ''),
  },
  {
    key: 'phone_numbers',
    header: 'Phone',
    type: 'array',
    format: (value: string[]) => (Array.isArray(value) ? value[0] || '' : value || ''),
  },
  {
    key: 'job_title',
    header: 'Current Title',
    type: 'string',
  },
  {
    key: 'job_company_name',
    header: 'Current Company',
    type: 'string',
  },
  {
    key: 'location_name',
    header: 'Location',
    type: 'string',
  },
  {
    key: 'birth_date',
    header: 'Date of Birth',
    type: 'date',
    format: (value: string) => {
      try {
        return value ? new Date(value).toISOString().split('T')[0] : '';
      } catch {
        return '';
      }
    },
  },
  {
    key: 'age',
    header: 'Age',
    type: 'number',
    format: (value: number) => value?.toString() || '0',
  },
  {
    key: 'gender',
    header: 'Gender',
    type: 'enum',
    enum: Gender,
    format: (value: string) => (Object.values(Gender).includes(value as Gender) ? value : Gender.NA),
  },
  {
    key: 'marital_status',
    header: 'Marital Status',
    type: 'enum',
    enum: MaritalStatus,
    format: (value: string) => (Object.values(MaritalStatus).includes(value as MaritalStatus) ? value : MaritalStatus.NA),
  },
  {
    key: 'inferred_salary',
    header: 'Inferred Salary (LPA)',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(2) : '0'),
  },
  {
    key: 'experience_years',
    header: 'Years of Experience',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(2) : '0'),
  },
  {
    key: 'total_job_changes',
    header: 'Total Job Changes',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(2) : '0'),
  },
  {
    key: 'average_tenure',
    header: 'Average Tenure',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(2) : '0'),
  },
  {
    key: 'total_tenure',
    header: 'Total Tenure',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(2) : '0'),
  },
  {
    key: 'current_role_tenure',
    header: 'Current Role Tenure',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(1) : '0'),
  },
  {
    key: 'inferred_years_experience',
    header: 'Total Experience',
    type: 'string',
  },
  {
    key: 'notice_period',
    header: 'Notice Period',
    type: 'enum',
    enum: NoticeStatus,
    format: (value: string) => (Object.values(NoticeStatus).includes(value as NoticeStatus) ? value : NoticeStatus.NA),
  },
  {
    key: 'key_skills',
    header: 'Key Skills',
    type: 'string',
    format: (value: string) => value?.replace(/,/g, ';') || '', // Replace commas with semicolons to avoid CSV issues
  },
  {
    key: 'education_course_ug',
    header: 'UG Degree',
    type: 'string',
  },
  {
    key: 'education_institute_ug',
    header: 'UG Institute',
    type: 'string',
  },
  {
    key: 'ug_graduation_year',
    header: 'UG Year',
    type: 'number',
    format: (value: number) => (value > 1950 && value < 2030 ? value.toString() : ''),
  },
  {
    key: 'education_course_pg',
    header: 'PG Degree',
    type: 'string',
  },
  {
    key: 'education_institute_pg',
    header: 'PG Institute',
    type: 'string',
  },
  {
    key: 'pg_graduation_year',
    header: 'PG Year',
    type: 'number',
    format: (value: number) => (value > 1950 && value < 2030 ? value.toString() : ''),
  },
  {
    key: 'profile_url',
    header: 'Profile URL',
    type: 'url',
    format: (value: string) => value || '',
  },
  {
    key: 'status',
    header: 'Status',
    type: 'string',
    format: () => 'New',
  },
  {
    key: 'notes',
    header: 'Notes',
    type: 'string',
    format: () => '',
  },
  {
    key: 'unique_key_string',
    header: 'UniqueKey',
    type: 'string',
  },
];

interface Profile {
  title: string;
  network: string;
  username: string;
  is_primary: boolean;
  url: string;
}

export interface Application {
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
  [x: string]: any;
  education_course_pg: any;
  education_institute_ug: string;
  education_course_ug: string;
  key_skills: string;
  notice_period: string;
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
  hiringNaukriUrl?: { label: string; url: string };
  resdexNaukriUrl?: { label: string; url: string };
  displayPicture: { label: string; url: string };
  jobsId: string;
  jobSpecificFields: any;
  peopleId: string;
}

export interface ArxenaJobCandidateNode {
  id?: string;
  profileUrl: { label: string; url: string };
  displayPicture: { label: string; url: string };
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
  displayPicture?: { url: string; label: string };
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
  googleSheetId?: string;
  name: string;
  id: string;
  recruiterId: string;
  jobLocation?: string;
  arxenaSiteId?: string;
}
