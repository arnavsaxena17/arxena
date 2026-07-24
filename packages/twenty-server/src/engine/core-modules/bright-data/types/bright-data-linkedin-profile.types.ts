/**
 * Subset of Bright Data LinkedIn people dataset (gd_l1viktl72bvl7bjuj0) response fields.
 * @see https://docs.brightdata.com/api-reference/web-scraper-api/synchronous-requests
 */
export type BrightDataLinkedinProfileExperienceEntry = {
  title?: string;
  company?: string;
  company_linkedin?: string;
  location?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
};

export type BrightDataLinkedinProfileEducationEntry = {
  title?: string;
  url?: string;
  end_year?: string;
  description?: string | null;
};

export type BrightDataLinkedinProfileRecord = {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  linkedin_id?: string;
  linkedin_num_id?: string;
  url?: string;
  input_url?: string;
  about?: string;
  city?: string;
  country_code?: string;
  location?: string | null;
  current_company?: {
    link?: string;
    name?: string;
    company_id?: string;
    location?: string | null;
  } | null;
  current_company_name?: string;
  current_company_company_id?: string;
  experience?: BrightDataLinkedinProfileExperienceEntry[] | null;
  education?: BrightDataLinkedinProfileEducationEntry[] | null;
  educations_details?: string;
  followers?: number;
  connections?: number;
  avatar?: string;
  error?: string;
  warning?: string;
  warning_code?: string;
};
