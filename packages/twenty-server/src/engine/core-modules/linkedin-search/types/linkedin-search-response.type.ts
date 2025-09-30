// Base response interfaces
export interface LinkedInSearchParameter {
  object: 'LinkedinSearchParameter';
  id: string;
  title: string;
  additional_data?: Record<string, any>;
}

export interface LinkedInSearchParametersList {
  object: 'LinkedinSearchParametersList';
  items: LinkedInSearchParameter[];
  paging: {
    page_count: number;
  };
}

export interface LinkedInSkill {
  name: string;
  endorsement_count: number;
}

export interface LinkedInTenureInfo {
  years: number;
  months: number;
}

export interface LinkedInDateInfo {
  year: number;
  month?: number;
}

export interface LinkedInCurrentPosition {
  company: string;
  company_id: string | null;
  description: string | null;
  role: string;
  location: string | null;
  industry: string[];
  tenure_at_role: LinkedInTenureInfo;
  tenure_at_company: LinkedInTenureInfo;
  start: LinkedInDateInfo;
  end?: LinkedInDateInfo;
  skills: LinkedInSkill[] | null;
}

export interface LinkedInEducation {
  degree: string | null;
  field_of_study: string | null;
  school: string;
  school_id: string | null;
  start: LinkedInDateInfo;
  end?: LinkedInDateInfo;
  school_details: {
    name: string;
    employeeCount: number;
    location: string;
    description: string;
    url: string;
    logo: string | null;
  };
}

export interface LinkedInWorkExperience {
  company: string;
  company_id: string | null;
  role: string;
  industry: string | null;
  start: LinkedInDateInfo;
  end?: LinkedInDateInfo;
  skills: LinkedInSkill[] | null;
}

export interface LinkedInCertification {
  name: string;
  organization: string;
  organization_id: string | null;
  url: string;
  start: LinkedInDateInfo;
  end?: LinkedInDateInfo;
}

export interface LinkedInProject {
  name: string;
  description: string;
  skills: string[];
  start: LinkedInDateInfo;
  end?: LinkedInDateInfo;
}

export interface LinkedInLastOutreachActivity {
  type: 'SEND_MESSAGE' | 'ACCEPT_INVITATION';
  performed_at: string;
}

export interface LinkedInPrivacySettings {
  allowConnectionsBrowse: boolean;
  showPremiumSubscriberIcon: boolean;
}

export interface LinkedInRevenueRange {
  min: number;
  max: number;
  currency: string;
}

export interface LinkedInAuthor {
  public_identifier: string | null;
  id: string | null;
  name: string | null;
  is_company: boolean;
  headline: string;
}

export interface LinkedInWrittenBy {
  id: string;
  public_identifier: string;
  name: string;
}

export interface LinkedInPermissions {
  can_react: boolean;
  can_share: boolean;
  can_post_comments: boolean;
}

export interface LinkedInRepostedBy {
  public_identifier: string | null;
  id: string | null;
  name: string | null;
  is_company: boolean;
  headline: string;
}

export interface LinkedInRepostContent {
  id: string;
  date: string;
  parsed_datetime: string;
  author: LinkedInAuthor;
  text: string;
}

export interface LinkedInMention {
  url: string;
  start: number;
  length: number;
}

export interface LinkedInAttachmentSize {
  width: number;
  height: number;
}

export interface LinkedInImageAttachment {
  id: string;
  file_size?: number;
  unavailable: boolean;
  mimetype?: string;
  url?: string;
  url_expires_at?: number;
  type: 'img';
  size: LinkedInAttachmentSize;
  sticker: boolean;
}

export interface LinkedInVideoAttachment {
  id: string;
  file_size?: number;
  unavailable: boolean;
  mimetype?: string;
  url?: string;
  url_expires_at?: number;
  type: 'video';
  size: LinkedInAttachmentSize;
  gif: boolean;
}

export interface LinkedInAudioAttachment {
  id: string;
  file_size?: number;
  unavailable: boolean;
  mimetype?: string;
  url?: string;
  url_expires_at?: number;
  type: 'audio';
  duration?: number;
  voice_note: boolean;
}

export interface LinkedInFileAttachment {
  id: string;
  file_size?: number;
  unavailable: boolean;
  mimetype?: string;
  url?: string;
  url_expires_at?: number;
  type: 'file';
  file_name: string;
}

export interface LinkedInLinkedinPostAttachment {
  id: string;
  file_size?: number;
  unavailable: boolean;
  mimetype?: string;
  url?: string;
  url_expires_at?: number;
  type: 'linkedin_post';
}

export interface LinkedInVideoMeetingAttachment {
  id: string;
  file_size?: number;
  unavailable: boolean;
  mimetype?: string;
  url?: string;
  url_expires_at?: number;
  type: 'video_meeting';
  starts_at: number | null;
  expires_at: number | null;
  time_range: number | null;
}

export type LinkedInAttachment = 
  | LinkedInImageAttachment
  | LinkedInVideoAttachment
  | LinkedInAudioAttachment
  | LinkedInFileAttachment
  | LinkedInLinkedinPostAttachment
  | LinkedInVideoMeetingAttachment;

export interface LinkedInPollOption {
  id: string;
  text: string;
  win: boolean;
  votes_count: number;
}

export interface LinkedInPoll {
  id: string;
  total_votes_count: number;
  question: string;
  is_open: boolean;
  options: LinkedInPollOption[];
}

export interface LinkedInGroup {
  id: string;
  name: string;
  private: boolean;
}

export interface LinkedInAnalytics {
  impressions: number;
  engagements: number;
  engagement_rate: number;
  clicks: number;
  clickthrough_rate: number;
  page_viewers_from_this_post?: number;
  followers_gained_from_this_post?: number;
  members_reached?: number;
}

export interface LinkedInCompany {
  id: string | null;
  public_identifier: string | null;
  name: string | null;
  profile_url: string | null;
  profile_picture_url: string | null;
}

// Main search result interfaces
export interface LinkedInPeopleSearchResult {
  object: 'SearchResult';
  type: 'PEOPLE';
  id: string;
  public_identifier: string | null;
  public_profile_url: string | null;
  profile_url: string | null;
  profile_picture_url: string | null;
  profile_picture_url_large: string | null;
  member_urn: string | null;
  name: string | null;
  first_name: string;
  last_name: string;
  network_distance: 'SELF' | 'DISTANCE_1' | 'DISTANCE_2' | 'DISTANCE_3' | 'OUT_OF_NETWORK';
  location: string | null;
  industry: string | null;
  keywords_match: string;
  headline: string;
  connections_count: number;
  followers_count: number;
  pending_invitation: boolean;
  can_send_inmail: boolean;
  hiddenCandidate: boolean;
  interestLikelihood: string;
  privacySettings: LinkedInPrivacySettings;
  skills: LinkedInSkill[];
  recruiter_candidate_id?: string;
  recruiter_pipeline_category?: string;
  premium: boolean;
  verified: boolean;
  open_profile: boolean;
  shared_connections_count: number;
  recent_posts_count: number;
  recently_hired: boolean;
  mentioned_in_the_news: boolean;
  last_outreach_activity?: LinkedInLastOutreachActivity;
  current_positions: LinkedInCurrentPosition[];
  education: LinkedInEducation[];
  work_experience: LinkedInWorkExperience[];
  certifications: LinkedInCertification[];
  projects: LinkedInProject[];
  interests?: string;
}

export interface LinkedInCompanySearchResult {
  object: 'SearchResult';
  type: 'COMPANY';
  id: string;
  name: string;
  location: string | null;
  profile_url: string;
  industry: string;
  summary: string | null;
  followers_count: number;
  job_offers_count: number;
  headcount: string;
  revenue_range?: LinkedInRevenueRange;
}

export interface LinkedInPostSearchResult {
  object: 'SearchResult';
  type: 'POST';
  provider: 'LINKEDIN';
  id: string;
  social_id: string;
  share_url: string;
  title: string;
  text: string;
  date: string;
  parsed_datetime: string;
  reaction_counter: number;
  comment_counter: number;
  repost_counter: number;
  impressions_counter: number;
  user_reacted?: 'LIKE' | 'PRAISE' | 'APPRECIATION' | 'EMPATHY' | 'INTEREST' | 'ENTERTAINMENT';
  author: LinkedInAuthor;
  written_by: LinkedInWrittenBy;
  permissions: LinkedInPermissions;
  is_repost: boolean;
  repost_id?: string;
  reposted_by?: LinkedInRepostedBy;
  repost_content?: LinkedInRepostContent;
  mentions: LinkedInMention[];
  attachments: LinkedInAttachment[];
  poll?: LinkedInPoll;
  group?: LinkedInGroup;
  analytics?: LinkedInAnalytics;
}

export interface LinkedInJobSearchResult {
  object: 'SearchResult';
  type: 'JOB';
  id: string;
  reference_id: string;
  title: string;
  location: string | null;
  posted_at: string | null;
  reposted: boolean;
  url: string;
  promoted: boolean;
  benefits: string[];
  easy_apply: boolean;
  company: LinkedInCompany | null;
}

export type LinkedInSearchResult = 
  | LinkedInPeopleSearchResult
  | LinkedInCompanySearchResult
  | LinkedInPostSearchResult
  | LinkedInJobSearchResult;

export interface LinkedInSearchConfig {
  params: any; // This would be the original search parameters
}

export interface LinkedInSearchPaging {
  start: number | null;
  page_count: number;
  total_count: number;
}

export interface LinkedInSearchResponse {
  object: 'LinkedinSearch';
  items: LinkedInSearchResult[];
  config: LinkedInSearchConfig;
  paging: LinkedInSearchPaging;
  cursor: string | null;
}

// Error response interfaces
export interface LinkedInErrorResponse {
  title: string;
  detail?: string;
  instance?: string;
  type: string;
  status: number;
  connectionParams?: {
    imap_host: string;
    imap_encryption: string;
    imap_port: number;
    imap_user: string;
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
  };
}
