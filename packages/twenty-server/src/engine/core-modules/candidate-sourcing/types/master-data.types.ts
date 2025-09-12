export interface MasterDataNames {
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  middle_name: string | null;
  middle_initial: string | null;
  name: string | null;
  is_primary: boolean | null;
}

export interface MasterDataProfile {
  title: string | null;
  network: string | null;
  connections: number | null;
  username: string | null;
  is_primary: boolean | null;
  url: string | null;
}

export interface MasterDataJobApplication {
  job_board: string | null;
  job_id: string | null;
  applied_on: string | null;
}

export interface MasterDataJobProcess {
  job_id: string | null;
  applications: MasterDataJobApplication[];
  lusha: {
    checkAvailability: boolean;
    dataAvailability: boolean;
    dataObtained: boolean;
  };
  google_contacts: {
    added: boolean;
  };
  status: string[];
  events: any[];
  arx_last_updated: string;
}

export interface MasterDataLocation {
  name: string | null;
  locality: string | null;
  region: string | null;
  subregion: string | null;
  country: string | null;
  continent: string | null;
  type: string | null;
  geo: any | null;
  postal_code: string | null;
  zip_plus_4: string | null;
  street_address: string | null;
  address_line_2: string | null;
  most_recent: boolean | null;
  is_primary: boolean | null;
  last_updated: string | null;
}

export interface MasterDataCompany {
  name: string | null;
  size: string | null;
  founded: number | null;
  industry: string | null;
  linkedin_url: string | null;
  linkedin_id: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  website: string | null;
  ticker: string | null;
  type: string | null;
  raw: any[];
  fuzzy_match: boolean | null;
  is_primary: boolean | null;
}

export interface MasterDataExperience {
  company: MasterDataCompany;
  locations: MasterDataLocation[];
  title: {
    name: string | null;
    raw: string | null;
    role: string | null;
    sub_role: string | null;
    levels: string[];
  };
  start_date: string | null;
  end_date: string | null;
  summary: string | null;
  is_primary: boolean | null;
}

export interface MasterDataEducation {
  school: {
    name: string | null;
    type: string | null;
    id: string | null;
    location: MasterDataLocation;
    linkedin_url: string | null;
    facebook_url: string | null;
    twitter_url: string | null;
    linkedin_id: string | null;
    website: string | null;
    domain: string | null;
    raw: string[];
  };
  degrees: string[];
  start_date: string | null;
  end_date: string | null;
  gpa: number | null;
  summary: string | null;
  is_primary: boolean | null;
}

export interface MasterDataCertification {
  name: string | null;
  organization: string | null;
  start_date: string | null;
  end_date: string | null;
  is_primary: boolean | null;
}

export interface MasterDataSkill {
  name: string | null;
  is_primary: boolean | null;
}

export interface MasterDataInterest {
  name: string | null;
  is_primary: boolean | null;
}

export interface MasterDataIndustry {
  name: string | null;
  is_primary: boolean | null;
}

export interface MasterDataEmails {
  work: string[];
  personal: string[];
  others: string[];
}

export interface MasterDataExperienceStats {
  total_experience: number;
  current_role_tenure: number;
  total_job_changes: number;
  average_tenure: number;
  promotions: any;
  longest_tenure: number;
  shortest_tenure: number;
  companies_worked_for: string[];
  roles_worked_in: string[];
  most_recent_role: string;
}

export interface MasterDataFormat {
  names: MasterDataNames;
  id: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  middle_initial: string | null;
  full_name: string | null;
  job_company_name: string | null;
  job_company_id: string | null;
  location_name: string | null;
  job_company_linkedin_url: string | null;
  job_company_website: string | null;
  location_region: string | null;
  location_locality: string | null;
  location_metro: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  location_country: string | null;
  profile_title: string | null;
  inferred_salary: number | null;
  inferred_years_experience: number | null;
  industry: string | null;
  country: string | null;
  birth_date_fuzzy: string | null;
  birth_date: string | null;
  unique_key_string: string;
  gender: string | null;
  email_address: string[];
  emails: MasterDataEmails;
  industries: MasterDataIndustry[];
  profiles: MasterDataProfile[];
  phone_numbers: string[];
  phone_number: string | null;
  mobile_phone: string | null;
  job_process: MasterDataJobProcess;
  locations: MasterDataLocation[];
  experience: MasterDataExperience[];
  experience_stats: MasterDataExperienceStats;
  last_updated: string | null;
  education: MasterDataEducation[];
  certifications: MasterDataCertification[];
  interests: MasterDataInterest[];
  skills: MasterDataSkill[];
  data_sources: string[];
  tables: string[];
  std_function: string | null;
  std_grade: string | null;
  std_function_root: string | null;
  data_source: string;
  upload_id: string | null;
  all_numbers: string[];
  all_mails: string[];
  profile_url: string | null;
  job_name: string | null;
  job_title: string | null;
  ug_education_institute: string | null;
  ug_degree: string | null;
  socialprofiles: any[];
  queryId: string | null;
}

export function createMasterDataTemplate(): MasterDataFormat {
  return {
    names: {
      first_name: null,
      last_name: null,
      title: null,
      middle_name: null,
      middle_initial: null,
      name: null,
      is_primary: null,
    },
    id: null,
    first_name: null,
    last_name: null,
    middle_name: null,
    middle_initial: null,
    full_name: null,
    job_company_name: null,
    job_company_id: null,
    location_name: null,
    job_company_linkedin_url: null,
    job_company_website: null,
    location_region: null,
    location_locality: null,
    location_metro: null,
    linkedin_url: null,
    facebook_url: null,
    twitter_url: null,
    location_country: null,
    profile_title: null,
    inferred_salary: null,
    inferred_years_experience: null,
    industry: null,
    country: null,
    birth_date_fuzzy: null,
    birth_date: null,
    unique_key_string: "",
    gender: null,
    email_address: [],
    emails: { work: [], personal: [], others: [] },
    industries: [],
    profiles: [],
    phone_numbers: [],
  phone_number: null,
  mobile_phone: null,
    job_process: {
      job_id: null,
      applications: [],
      lusha: {
        checkAvailability: false,
        dataAvailability: false,
        dataObtained: false,
      },
      google_contacts: {
        added: false,
      },
      status: [],
      events: [],
      arx_last_updated: new Date().toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
    },
    locations: [],
    experience: [],
    experience_stats: {
      total_experience: 0,
      current_role_tenure: 0,
      total_job_changes: 0,
      average_tenure: 0,
      promotions: {},
      longest_tenure: 0,
      shortest_tenure: 0,
      companies_worked_for: [],
      roles_worked_in: [],
      most_recent_role: "",
    },
    last_updated: null,
    education: [],
    certifications: [],
    interests: [],
    skills: [],
    data_sources: [],
    tables: [],
    std_function: null,
    std_grade: null,
    std_function_root: null,
    data_source: "",
    upload_id: null,
    all_numbers: [],
    all_mails: [],
    profile_url: null,
    job_name: null,
    job_title: null,
    ug_education_institute: null,
    ug_degree: null,
    socialprofiles: [],
    queryId: null,
  };
}
