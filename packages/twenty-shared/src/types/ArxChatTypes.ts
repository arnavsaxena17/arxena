export interface ChatTableProps {
  individuals: PersonNode[];
  selectedIndividual: string;
  unreadMessages: UnreadMessageListManyCandidates;
  onIndividualSelect: (id: string) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
}

export interface CandidateFieldEdge {
  node: CandidateFieldNode;
}

export interface CandidateFieldNode {
  id: string;
  name: string;
}


export interface CandidateEnrichmentEdge {
  node: CandidateEnrichmentNode;
}

export interface CandidateEnrichmentNode {
  id: string;
  name: string;
}

export interface CandidateEnrichments {
  edges: CandidateEnrichmentEdge[];
}

export interface Jobs {
  edges: JobEdge[];
}

export interface JobDropdownProps {
  jobs: Job[];
  selectedJob: string;
  onJobChange: (jobId: string) => void;
}
export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string;
}

export interface CandidateEdge {
  node: CandidateNode;
}

export type JobProcessStage = {
  id: string;
  name: string;
  order: number;
  actions?: string[];
  JobProcessStageName?: 'APPLICATION' | 'INTERVIEW' | 'OFFER' | 'ONBOARDING';
  JobProcessStageStatus?: 'PENDING' | 'COMPLETED' | 'IN_PROGRESS';
};

export type JobProcess = {
  jobId: string;
  clientId?: string;
  stages: JobProcessStage[];
  createdAt: Date;
  updatedAt: Date;
};

export type JobProcessModificationStage = Omit<JobProcessStage, 'id'>;

export type JobProcessModifications = {
  JobProcessModificationType: 'ADD' | 'REMOVE' | 'UPDATE';
  JobProcessModificationStage?: JobProcessModificationStage;
};

export type JobProcessModificationsType = {
  jobId: string;
  JobProcessModifications: JobProcessModifications;
};

export interface Name {
  firstName: string | '';
  lastName: string | '';
}

export interface Industry {
  name: string | '';
  is_primary: boolean | '';
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
  type:
    | 'string'
    | 'number'
    | 'date'
    | 'enum'
    | 'boolean'
    | 'array'
    | 'url'
    | 'object';
  enum?: any;
  format?: (value: any) => string;
}

export interface WhatsappMessageData {
  id: string;
  body: string;
  
  type: string;
  from: string;
  linkedin_url?: string;
  to: string;
  timestamp: number;
  fromMe: boolean;
  quotedMsg: any | null;
  chrome_extension_id: string;
}

export interface WhatsappMessageJobData {
  data: WhatsappMessageData;
  batchId?: string;
}

export interface ProcessCandidatesJobData {
  data: UserProfile[];
  rawData?: any[];
  dataSource?: string;
  jobId: string;
  jobName: any;
  batchName?: string;
  timestamp: any;
  apiToken: any;
  origin: string;
  userId?: string;
  queueStartChatAfter?: boolean;
  uploadSessionId?: string;
}

export interface ProcessResumeUploadsJobData {
  filePaths: string[];
  jobId: string;
  jobName: string;
  userId: string;
  apiToken: string;
  timestamp: string;
  origin: string;
}

export interface ProcessAiFiltersJobData {
  aiFilters: AiFilter[];
  objectNameSingular: string;
  availableSortDefinitions: any[];
  availableFilterDefinitions: any[];
  objectRecordId: string;
  selectedRecordIds: string[];
  jobId: string;
  batchName?: string;
  timestamp: string;
  apiToken: string;
  origin: string;
}

export interface GmailDraftShortlistJobData {
  candidateIds: string[];
  origin: string;
  apiToken: string;
  jobId?: string;
  jobName?: string;
  batchName?: string;
  timestamp?: string;
}

export const columnDefinitions: ColumnDefinition[] = [
  {
    key: 'fullName',
    header: 'Candidate Name',
    type: 'string',
    format: (value: string) => value?.trim() || '',
  },
  {
    key: 'emailAddress',
    header: 'Email',
    type: 'array',
    format: (value: string[]) =>
      Array.isArray(value) ? value[0] || '' : value || '',
  },
  {
    key: 'phoneNumbers',
    header: 'Phone',
    type: 'array',
    format: (value: string[]) =>
      Array.isArray(value) ? value[0] || '' : value || '',
  },
  {
    key: 'jobTitle',
    header: 'Current Title',
    type: 'string',
  },
  {
    key: 'jobCompanyName',
    header: 'Current Company',
    type: 'string',
  },
  {
    key: 'locationName',
    header: 'Location',
    type: 'string',
  },
  {
    key: 'birthDate',
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
    format: (value: string) =>
      Object.values(Gender).includes(value as Gender) ? value : Gender.NA,
  },
  {
    key: 'maritalStatus',
    header: 'Marital Status',
    type: 'enum',
    enum: MaritalStatus,
    format: (value: string) =>
      Object.values(MaritalStatus).includes(value as MaritalStatus)
        ? value
        : MaritalStatus.NA,
  },
  {
    key: 'inferredSalary',
    header: 'Inferred Salary (LPA)',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(2) : '0'),
  },
  {
    key: 'experienceYears',
    header: 'Years of Experience',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(2) : '0'),
  },
  {
    key: 'totalJobChanges',
    header: 'Total Job Changes',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(2) : '0'),
  },
  {
    key: 'averageTenure',
    header: 'Average Tenure',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(2) : '0'),
  },
  {
    key: 'totalTenure',
    header: 'Total Tenure',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(2) : '0'),
  },
  {
    key: 'currentRoleTenure',
    header: 'Current Role Tenure',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(1) : '0'),
  },
  {
    key: 'inferredYearsExperience',
    header: 'Total Experience',
    type: 'number',
    format: (value: number) => (value ? value.toFixed(1) : '0'),
  },
  {
    key: 'noticePeriod',
    header: 'Notice Period',
    type: 'enum',
    enum: NoticeStatus,
    format: (value: string) =>
      Object.values(NoticeStatus).includes(value as NoticeStatus)
        ? value
        : NoticeStatus.NA,
  },
  {
    key: 'keySkills',
    header: 'Key Skills',
    type: 'string',
    format: (value: string) => value?.replace(/,/g, ';') || '', // Replace commas with semicolons to avoid CSV issues
  },
  {
    key: 'educationCourseUg',
    header: 'UG Degree',
    type: 'string',
    format: (value: string) => value || '',
  },
  {
    key: 'educationInstituteUg',
    header: 'UG Institute',
    type: 'string',
    format: (value: string) => value || '',
  },
  {
    key: 'ugGraduationYear',
    header: 'UG Year',
    type: 'number',
    format: (value: number) =>
      value > 1950 && value < 2030 ? value.toString() : '',
  },
  {
    key: 'educationCoursePg',
    header: 'PG Degree',
    type: 'string',
    format: (value: string) => value || '',
  },
  {
    key: 'educationInstitutePg',
    header: 'PG Institute',
    type: 'string',
    format: (value: string) => value || '',
  },
  {
    key: 'pgGraduationYear',
    header: 'PG Year',
    type: 'number',
    format: (value: number) =>
      value > 1950 && value < 2030 ? value.toString() : '',
  },
  {
    key: 'profileUrl',
    header: 'Profile URL',
    type: 'url',
    format: (value: string) => value || '',
  },
  {
    key: 'status',
    header: 'Status',
    type: 'string',
    format: (value: string) => value || '',
  },
  {
    key: 'notes',
    header: 'Notes',
    type: 'string',
    format: (value: string) => value || '',
  },
  {
    key: 'uniqueStringKey',
    header: 'uniqueStringKey',
    type: 'string',
    format: (value: string) => value || '',
  },
  {
    key: 'languages',
    header: 'Languages',
    type: 'array',
    format: (value: string[]) => (Array.isArray(value) ? value.join('; ') : ''),
  },
  {
    key: 'englishLevel',
    header: 'English Proficiency',
    type: 'object',
    format: (value: { level: string; description: string }) =>
      value?.level || '',
  },
  {
    key: 'experienceDepartments',
    header: 'Experience Departments',
    type: 'array',
    format: (value: string[]) => (Array.isArray(value) ? value.join('; ') : ''),
  },
  {
    key: 'preferredLocations',
    header: 'Preferred Locations',
    type: 'array',
    format: (value: string[]) => (Array.isArray(value) ? value.join('; ') : ''),
  },
  {
    key: 'mayAlsoKnow',
    header: 'Related Skills',
    type: 'array',
    format: (value: string[]) => (Array.isArray(value) ? value.join('; ') : ''),
  },
  {
    key: 'isFresher',
    header: 'Is Fresher',
    type: 'boolean',
    format: (value: boolean) => (value ? 'Yes' : 'No'),
  },
  {
    key: 'isExperienced',
    header: 'Is Experienced',
    type: 'boolean',
    format: (value: boolean) => (value ? 'Yes' : 'No'),
  },
  {
    key: 'activeOn',
    header: 'Last Active',
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
    key: 'isCvAttached',
    header: 'CV Attached',
    type: 'boolean',
    format: (value: boolean) => (value ? 'Yes' : 'No'),
  },
  {
    key: 'isProfilePurchased',
    header: 'isProfilePurchased',
    type: 'boolean',
    format: (value: boolean) => (value ? 'Yes' : 'No'),
  },
  {
    key: 'profilePhotoUrl',
    header: 'Profile Photo URL',
    type: 'url',
    format: (value: string) => value || '',
  },
  {
    key: 'englishAudioIntroUrl',
    header: 'English Audio Intro URL',
    type: 'url',
    format: (value: string) => value || '',
  },
  {
    key: 'highestEducationLevel',
    header: 'Highest Education',
    type: 'string',
    format: (value: string) => value || '',
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
  startDate: string | null;
  endDate: string | null;
  /**
   * Whether this experience entry represents a current role.
   * Optional so existing data remains valid.
   */
  isCurrent?: boolean;
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
  totalYearsExperience: TotalYearsExperience;
  currentSalary: CurrentSalary;
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

export type TransformedCandidateForTable = Omit<
  UserProfile,
  'phoneNumber' | 'emailAddress' | 'linkedinUrl'
> & {
  // DataTable UI-specific fields
  __isFetched?: boolean;
  tempId?: string;
  
  // Handsontable-compatible field overrides (wrap strings in objects for consistency)
  phoneNumber: { primaryPhoneNumber: string };
  email: { primaryEmail: string };
  linkedinUrl?: { primaryLinkUrl: string };
  hiringNaukriUrl?: { primaryLinkUrl: string };
  resdexNaukriUrl?: { primaryLinkUrl: string };
  displayPicture?: { primaryLinkUrl: string };
  
  // UI state fields
  candConversationStatus: string;
  status: string;
  startChat: boolean;
  stopChat: boolean;
  startChatCompleted: boolean;
  startVideoInterviewChat: boolean;
  startVideoInterviewChatCompleted: boolean;
  startMeetingSchedulingChat: boolean;
  startMeetingSchedulingChatCompleted: boolean;
  engagementStatus: boolean;
  messagingChannel: string;
  chatCount: number;
  lastEngagementChatControl: any;
  
  // Relationship edges
  whatsappMessages: { edges: any[] };
  emailMessages: { edges: any[] };
  candidateFieldValues: { edges: any[] };
  candidateReminders: { edges: any[] };
  jobs: { id: string; name: string };
  people: { id: string };
  attachments: any;
  videoInterview: any;
  whatsappProvider: string;
  input: string;
  clientInterview?: any;
  remarks?: string;
  
  // LinkedIn-specific display fields
  name: string;
  headline?: string;
  profilePictureUrl?: string;
  networkDistance?: string;
  premium?: boolean;
  verified?: boolean;
  sharedConnectionsCount?: number;
  followersCount?: number;
  keywordsMatch?: string;
  
  // Relevance scoring fields
  relevanceScore?: number; // 0-1 relevance score
  relevanceLabel?: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant';
  matchReasons?: string[];
  mismatchReasons?: string[];
  educationMatch?: boolean | null; // Whether the candidate's education matches the query requirements
  
  // Naming aliases for backwards compatibility
  jobTitle: string;
  company: string;
  location: string;
  peopleId: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface UserProfile {
  // Basic profile information
  id: string | null;
  names: Name;
  firstName: string;
  lastName: string;
  middleName: string | null;
  middleInitial: string | null;
  fullName: string;
  jobCompanyName: string;
  jobCompanyId: string | null;

  // Job and company information
  jobTitle: string;
  locationName: string;
  jobCompanyLinkedinUrl: string | null;
  jobCompanyWebsite: string | null;
  profileTitle: string;
  profileUrl: string;
  
  // Location information
  locationRegion: string | null;
  locationLocality: string | null;
  locationMetro: string | null;
  locationCountry: string | null;
  country: string | null;
  locations: Location[];
  
  
  // Social profiles
  linkedinUrl: string;
  facebookUrl: string | null;
  twitterUrl: string | null;
  
  // Experience and salary
  inferredSalary: number | null;
  inferredYearsExperience: number | null;
  industry: string | null;
  industries: Industry[];
  experience: Experience[];
  experienceStats: ExperienceStats;
  
  // Education
  education: Education[];
  educationCoursePg: any;
  educationInstituteUg: string;
  educationCourseUg: string;
  
  // Skills and interests
  skills: string | null;
  keySkills: string;
  interests: string[];
  
  // Personal information
  birthDateFuzzy: string | null;
  birthDate: string | null;
  gender: string | null;
  maritalStatus?: string | null;
  homeTown?: string | null;
  
  // Job application specific
  noticePeriod: string;
  resumeHeadline?: string | null;
  preferredLocations?: string | null;
  displayPicture?: string | { primaryLinkLabel: string; primaryLinkUrl: string } | null;
  hiringNaukriUrl?: { primaryLinkLabel: string; primaryLinkUrl: string } | null;
  resumeDownloadUrl?: string | null;
  
  // LinkedIn specific fields (consolidated)
  linkedinSummary?: string | null;
  linkedinConnections?: number | string | null;
  linkedinRecommendations?: any[] | null;
  linkedinFollowers?: number | string | null;
  lastActivity?: string | null;
  linkedinHeadline?: string | null;
  linkedinEmailId?: string | null;
  linkedinSocialProfile?: string | null;
  linkedinJobTitle?: string | null;
  linkedinSpecificData?: Record<string, any> | null;
  
  // Additional profile data
  certifications?: Array<{
    name: string | null;
    organization: string | null;
    start_date: string | null;
    end_date: string | null;
    is_primary: boolean;
  }>;
  languages?: string[] | null;
  
  // Metadata
  lastSeen: {
    source: string | null;
    timestamp: string | null;
  };
  lastUpdated: string;
  stdLastUpdated: string | null;
  created: number;
  creationSource: string;
  dataSources: string[];
  dataSource: string;
  queryId: string[];
  jobName: string;
  uploadCount: number;
  uploadId: string;
  uniqueStringKey: string;
  tables: string[];
  
  // Standardization fields
  stdFunction: string;
  stdGrade: string;
  stdFunctionRoot: string;
  
  // Contact information
  phoneNumbers?: string[];
  phoneNumber?: string;
  emailAddresses?: string[];
  emailAddress?: string;
  // Additional data fields
  creationParticulars?: {
    created: number;
    creation_source: string;
    data_sources: string[];
  };
  jobProcessEvents?: Array<{
    type: string;
    value: any;
    timestamp: string;
  }> | null;
  qaFields?: Record<string, any> | null;
  additionalData?: Record<string, any> | null;
}



// Define the oneCandidateObject interface
// interface Candidate {
//   name: string;
//   personId: string;
//   status: string;
//   engagementStatus: boolean;
//   startChat: boolean;
//   whatsappProvider: string;
// }

// Define the onePersonObject interface


export interface ArxenaCandidateNode {
  name: string;
  engagementStatus: boolean;
  jobTitle: string;
  jobCompanyName: string;
  startChat: boolean;
  phoneNumber: { primaryPhoneNumber: string };
  email: { primaryEmail: any };
  campaign: string;
  source: string;
  startVideoInterviewChat: boolean;
  startMeetingSchedulingChat: boolean;
  uniqueStringKey: string;
  stopChat: boolean;
  hiringNaukriUrl?: { primaryLinkLabel: string; primaryLinkUrl: string };
  resdexNaukriUrl?: { primaryLinkLabel: string; primaryLinkUrl: string };
  linkedinUrl?: { primaryLinkLabel: string; primaryLinkUrl: string };
  displayPicture: { primaryLinkLabel: string; primaryLinkUrl: string };
  jobsId: string;
  peopleId: string;
  messagingChannel: string;
}

export interface ArxenaJobCandidateNode {
  id?: string;
  lastActive?: DateTimeField;
  lastUpdated?: DateTimeField;
  campaignName?: string;
  profileUrl: { primaryLinkLabel: string; primaryLinkUrl: string };
  displayPicture: { primaryLinkLabel: string; primaryLinkUrl: string };
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
  emails: { primaryEmail: string };
  uniqueStringKey?: string;
  phones?: { primaryPhoneNumber: string };
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
  linkedinLink?: { primaryLinkLabel: string; primaryLinkUrl: string };
  displayPicture?: { primaryLinkLabel: string; primaryLinkUrl: string };
  emails?: { primaryEmail: string };
  phones?: { primaryPhoneNumber: string };
  uniqueStringKey?: string | null;
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


// // Interface for chat message with tool call
// export interface ToolChatMessage {
//   tool_call_id: string;
//   name: string; // Required for tool messages
//   role: ChatRole;
//   content: string;
// }

export interface TemplateComponent {
  type: string;
  text: string;
  format?: string;
  buttons?: Array<{
    type: string;
    text: string;
    url: string;
  }>;
}

export interface Template {
  name: string;
  components: TemplateComponent[];
  language: string;
  status: string;
  category: string;
  id: string;
}

export type ChatRole = 'system' | 'user' | 'tool' | 'assistant';

// Interface for chat message without tool call
// export interface ChatMessage {
//   role: ChatRole;
//   content: string | null;
//   name?: string; // Optional, only for tool messages
// }

// Type for chat history items
// export type ChatHistoryItem = ChatMessage | ToolChatMessage;

export type ChatHistoryItem = {
  role: ChatRole;
  content: string | null;
  tool_calls?: any;
  tool_call_id?: string;
  name?: string;
};

export interface AnswerMessageObj {
  questionsId: string;
  name: string;
  position: string;
  candidateId: string;
}

export interface SendAttachment {
  filePath: string;
  phoneNumberTo: string;
  attachmentMessage: string;
}
export interface BaileysAttachmentObject {
  phoneNumberTo: string;
  fileData: {
    fileName: string;
    filePath: string;
    fileBuffer: string;
    mimetype: string;
  };
}

export interface FacebookWhatsappAttachmentChatRequestBody {
  phoneNumberFrom: string;
  phoneNumberTo: string;
  attachmentText: string;
  mediaFileName: string;
  mediaID: string;
}
export interface BaileysIncomingMessage {
  message: string;
  messageTimeStamp: string;
  phoneNumberFrom: string;
  baileysMessageId: string;
  fromName: string;
  phoneNumberTo: string;
}

export interface whatappUpdateMessageObjType {
  id: string;
  messageObj: ChatHistoryItem[];
  candidateProfile: CandidateNode;
  candidateFirstName: string;
  messages: { [x: string]: any }[];
  phoneNumberFrom: string;
  phoneNumberTo: string;
  messageType: string;
  whatsappDeliveryStatus: string;
  whatsappMessageType: string;
  lastEngagementChatControl: string;

  whatsappMessageId: string;
  type?: string;
  typeOfMessage: string;
  databaseFilePath?: string;
}

export interface sendWhatsappTemplateMessageObjectType {
  template_name: string;
  recipient: string;
  recruiterName: string;
  candidateFirstName: string;
  recruiterJobTitle: string;
  recruiterCompanyName: string;
  recruiterCompanyDescription: string;
  jobPositionName: string;
  jobLocation: string;
}

export interface WhatsAppMessages {
  edges: WhatsAppMessagesEdge[];
}

export interface ClientInterviews {
  edges: ClientInterviewEdge[];
}

export interface CandidatesEdge {
  node: CandidateNode;
}

export interface ClientInterviewEdge {
  node: ClientInterviewNode;
}

export interface ClientInterviewNode {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  clientInterviewCompleted: boolean;
  jobId: boolean;
  candidateId: boolean;
}

export interface Candidates {
  edges: CandidatesEdge[];
}

// export interface Name {
//   firstName: string;
//   lastName: string;
// }

export interface PersonNode {
  phones: { primaryPhoneNumber: string };
  emails: { primaryEmail: string };

  linkedinLink?:{primaryLinkUrl:string,primaryLinkLabel:string}
  suitabilityDescription?: string;
  salary: string;
  city: string;
  uniqueStringKey: string;

  jobTitle: string;
  id: string;
  position: number;
  name: Name;
  candidates: Candidates;
}

export interface PersonEdge {
  node: PersonNode;
}

export interface People {
  edges: PersonEdge[];
}

export interface RootObject {
  people: People;
}

export interface ChatRequestBody {
  phoneNumberFrom: string;
  phoneNumberTo: string;
  messages: string; // Adjust the type according to the structure of 'messages'
}

export interface companyInfoType {
  name: string;
  companyId: string;
  descriptionOneliner: string;
}

export interface jobProfileType {
  name: any;
  jobLocation: string;
  id: string;
  recruiterId: string;
  company: companyInfoType;
}

interface Entry {
  id: string;
  changes: any[];
}

export interface WhatsAppBusinessAccount {
  object: string;
  entry: Entry[];
}

export const emptyCandidateProfileObj: CandidateNode = {
  name: '',
  id: '',
  chatCount: 0,
  input: '',
  candConversationStatus: '',
  startChat: false,
  stopChat: false,
  status: '',
  createdAt: '',
  attachments: {
    edges: [],
  },
  whatsappProvider: '',
  jobs: {
    name: '',
    id: '',
    isActive: false,
    recruiterId: '',
    company: {
      id: '',
      name: '',
      companyId: '',
      domainName: {"primaryLinkUrl":''},
      descriptionOneliner: '',
    },
    jobLocation: '',
    jobCode: '',
    whatsappMessages: {
      edges: [
        {
          node: {
            recruiterId: '',
            message: '',
            candidateId: '',
            jobsId: 'string',
            position: 0,
            messageType: '',
            phoneTo: '',
            updatedAt: '',
            createdAt: '',
            id: '',
            name: '',
            phoneFrom: '',
            messageObj: [],
            whatsappDeliveryStatus: '',
          },
        },
      ],
    },
  },
  candidateFieldValues: {
    edges: [],
  },
  videoInterview: {
    edges: [
      {
        node: {
          id: '',
          interviewLink: {
            primaryLinkLabel: '',
            primaryLinkUrl: '',
          },
          updatedAt: '',
          interviewCompleted: false,
          interviewStarted: false,
        },
      },
    ],
  },
  candidateReminders: {
    edges: [
      {
        node: {
          remindCandidateAtTimestamp: '',
          remindCandidateDuration: '',
          isReminderActive: false,
          name: '',
          id: '',
        },
      },
    ],
  },
  engagementStatus: false,
  phoneNumber: {
    primaryPhoneNumber: '',
  },
  email: {
    primaryEmail: '',
  },
  startMeetingSchedulingChat: false,
  lastEngagementChatControl: 'startChat' as chatControlType,
  startVideoInterviewChat: false,
  whatsappMessages: {
    edges: [
      {
        node: {
          recruiterId: '',
          message: '',
          candidateId: '',
          jobsId: 'string',
          position: 0,
          messageType: '',
          phoneTo: '',
          updatedAt: '',
          createdAt: '',
          id: '',
          name: '',
          phoneFrom: '',
          messageObj: [],
          whatsappDeliveryStatus: '',
        },
      },
    ],
  },
  emailMessages: {
    edges: [
      {
        node: {
          id: '',
          email: '',
          text: '',
          subject: '',
          recruiterId: '',
          candidateId: '',
          jobsId: '',
          messageThreadId: '',
          receivedAt: '',
          updatedAt: '',
          createdAt: '',
        },
      },
    ],
  },
  updatedAt: '',
  peopleId: '',
  people: {
    phones: { primaryPhoneNumber: '' },
    emails: { primaryEmail: '' },
    jobTitle: '',
    id: '',
    position: 0,
    uniqueStringKey: '',
    name: {
      firstName: '',
      lastName: '',
    },
    candidates: {
      edges: [],
    },
    salary: '',
    city: '',
  },
};

export interface Attachment {
  __typename: string;
  whatsappMessageId: string | null;
  authorId: string | null;
  candidateId: string | null;
  fullPath: string;
  personId: string | null;
  name: string;
  opportunityId: string | null;
  cvsSentId: string | null;
  updatedAt: string;
  createdAt: string;
  jobId: string | null;
  type: string;
  companyId: string | null;
  screeningId: string | null;
  clientInterviewId: string | null;
  id: string;
  recruiterInterviewId: string | null;
  activityId: string | null;
  offerId: string | null;
  questionId: string | null;
  answerId: string | null;
}

export interface candidateProfileType {
  first_name: any;
  id: string;
  jobsId: string;
  status: string;
  job: jobProfileType;
  phoneNumber: string;
  email: string;
  responsibleWorkspaceMemberId: string;
  input: string; // Add the 'input' property
}

export interface OpenAIArxSingleStepClient {
  personNode: PersonNode;
  openAIclient: OpenAI;
  anthropic: Anthropic;
}

export interface OpenAIArxMultiStepClient {
  personNode: PersonNode;
  openAIclient: OpenAI;
  anthropic: Anthropic;
}

export interface AttachmentMessageObject {
  phoneNumberTo: string;
  phoneNumberFrom: string;
  fullPath: string;
  fileData: {
    fileName: string;
    filePath: string;
    fileBuffer: string;
    mimetype: string;
  };
}

export interface UnreadMessageListManyCandidates {
  listOfUnreadMessages: UnreadMessagesPerOneCandidate[];
}

export interface UnreadMessagesPerOneCandidate {
  candidateId: string;
  ManyUnreadMessages: OneUnreadMessage[];
}

export interface OneUnreadMessage {
  message: string;
  id: string;
  whatsappDeliveryStatus: string;
}

export interface SelectOption {
  color: string;
  label: string;
  position: number;
  value: string;
}

export interface CurrentUserResponse {
  data: {
    currentUser: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      canImpersonate: boolean;
      supportUserHash: string;
      onboardingStep: string;
      workspaceMember: {
        id: string;
        name: {
          firstName: string;
          lastName: string;
        };
        colorScheme: string;
        avatarUrl: string;
        locale: string;
      };
      defaultWorkspace: {
        id: string;
        displayName: string;
        logo: string;
        domainName: string;
        inviteHash: string;
        allowImpersonation: boolean;
        subscriptionStatus: string;
        activationStatus: string;
        featureFlags: Array<{
          id: string;
          key: string;
          value: boolean;
          workspaceId: string;
        }>;
        currentCacheVersion: number;
        currentBillingSubscription: {
          id: string;
          status: string;
          interval: string;
        };
      };
      workspaces: Array<{
        workspace: {
          id: string;
          logo: string;
          displayName: string;
          domainName: string;
        };
      }>;
    };
  };
}

export interface BaseField {
  description?: string;
  icon?: string;
  label: string;
  name: string;
  objectMetadataId: string;
  type: FieldType;
  defaultValue?: any;
}

export interface TextField extends BaseField {
  type: 'TEXT';
}

export interface NumberField extends BaseField {
  type: 'NUMBER';
}

export interface BooleanField extends BaseField {
  type: 'BOOLEAN';
  defaultValue?: boolean;
}

export interface DateTimeField extends BaseField {
  type: 'DATE_TIME';
}

export interface SelectField extends BaseField {
  type: 'SELECT';
  options: SelectOption[];
}

export interface LinkField extends BaseField {
  type: 'LINKS';
}

export interface RawJsonField extends BaseField {
  type: 'RAW_JSON';
}

export interface ObjectMetadata {
  id?: string;
  nameSingular?: string;
  labelPlural?: string;
  labelSingular?: string;
  namePlural?: string;
  description?: string;
  icon?: string;
  fields?: {
    edges?: Array<{
      node?: FieldMetadata;
    }>;
  };
}

export interface ObjectCreationInput {
  object?: {
    description?: string;
    icon?: string;
    labelPlural?: string;
    labelSingular?: string;
    nameSingular?: string;
    namePlural?: string;
  };
}

export interface CreateOneFieldMetadataInput {
  field: {
    type: string;
    name: string;
    label: string;
    description?: string;
    icon?: string;
    objectMetadataId: string;
    options?: Array<{
      color: string;
      label: string;
      position: number;
      value: string;
    }>;
  };
}
export interface FieldMetadata {
  type: string;
  name: string;
  label: string;
  description?: string;
  icon?: string;
  objectMetadataId: string;
  options?: Array<{
    color: string;
    label: string;
    position: number;
    value: string;
  }>;
}
export interface CreateOneObjectInput {
  object: {
    description: string;
    icon: string;
    labelPlural: string;
    labelSingular: string;
    nameSingular: string;
    namePlural: string;
  };
}

export interface FieldCreationInput {
  field?: {
    description?: string;
    icon?: string;
    label?: string;
    name?: string;
    objectMetadataId?: string;
    type?: string;
    options?: Array<{
      color?: string;
      label?: string;
      position?: number;
      value?: string;
    }>;
    defaultValue?: any;
  };
}

export interface QueryResponse<T> {
  data?: {
    objects?: {
      edges?: Array<{
        node?: T;
      }>;
    };
  };
}

export interface Relation {
  fromDescription?: string | null;
  fromIcon?: string;
  fromLabel?: string;
  fromName?: string;
  fromObjectMetadataId?: string;
  relationType?: 'ONE_TO_MANY' | 'ONE_TO_ONE' | 'MANY_TO_ONE' | 'MANY_TO_MANY';
  toObjectMetadataId?: string;
  toDescription?: string;
  toLabel?: string;
  toIcon?: string;
  toName?: string;
  fromFieldMetadataId?: string;
  toFieldMetadataId?: string;
}

export interface RelationInput {
  relationMetadata: Relation;
}

export type FieldType =
  | 'SELECT'
  | 'DATE_TIME'
  | 'TEXT'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'LINKS'
  | 'RAW_JSON'
  | 'EMAILS'
  | 'PHONES';

export interface FieldOption {
  color?: string;
  label?: string;
  position?: number;
  value?: string;
}

export interface Field {
  description?: string;
  icon?: string;
  label?: string;
  name?: string;
  objectMetadataId?: string;
  type?: FieldType;
  options?: FieldOption[];
  defaultValue?: any;
}

export interface FieldInput {
  field?: Field;
}

// Video Interview Model Types
export interface VideoInterviewModel {
  name: string;
  country: string;
  language: string;
}

export interface VideoInterviewTemplate {
  name: string;
  videoInterviewModelId: string;
  jobId: string;
  introduction?: string;
  instructions?: string;
}

// Add country and language mapping types
export interface CountryNames {
  [key: string]: string[];
}

export interface CountryLanguages {
  [key: string]: string[];
}

export interface AiFilterField {
  name: string;
  type: string;
  description: string;
  id: number;
  enumValues?: string[];
}

export interface AiFilter {
  modelName: string;
  prompt: string;
  fields: AiFilterField[];
  selectedMetadataFields: string[];
  selectedModel: string;
  bestOf?: number;
}

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Define the possible roles in the chat

export const statusesArray = [
  'SCREENING',
  'INTERESTED',
  'NOT_INTERESTED',
  'NOT_FIT',
  'CV_SENT',
  'CV_RECEIVED',
  'RECRUITER_INTERVIEW',
  'CLIENT_INTERVIEW',
  'NEGOTIATION',
] as const;

export type WhatsappMessageType = 'messages' | 'media';
export interface ChatControlNode {
  chatControlType: string;
  nextNodes: string[];
  conditions?: {
    nextNode: string;
    evaluator: (candidate: CandidateNode) => boolean;
  }[];
}
export const allStatusesArray: [string, ...string[]] = [
  'ONLY_ADDED_NO_CONVERSATION',
  'CONVERSATION_STARTED_HAS_NOT_RESPONDED',
  'SHARED_JD_HAS_NOT_RESPONDED',
  'CANDIDATE_REFUSES_TO_RELOCATE',
  'STOPPED_RESPONDING_ON_QUESTIONS',
  'CANDIDATE_SALARY_OUT_OF_RANGE',
  'CANDIDATE_IS_KEEN_TO_CHAT',
  'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT',
  'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION',
  'CANDIDATE_DECLINED_OPPORTUNITY',
  'CONVERSATION_CLOSED_TO_BE_CONTACTED',
];

export type allStatuses = (typeof allStatusesArray)[number];
export type statuses = (typeof statusesArray)[number];

export type chatControlType =
  | 'startChat'
  | 'allStartedAndStoppedChats'
  | 'startVideoInterviewChat'
  | 'startMeetingSchedulingChat';
export interface ChatControlsObjType {
  chatControlType: chatControlType;
  chatMessageTemplate?: string;
}

// Type for chat history items

export interface ClientMeetingEdge {
  node: ClientMeetingNode;
}

export interface ClientMeetings {
  edges: ClientMeetingEdge[];
}

export interface ClientMeetingNode {
  id: string;
  interviewTime: InterviewTime;
  candidateId: string;
  candidateName: string;
}

export interface InterviewTime {
  date: string;
  time: string;
}


export interface MessageNode {
  recruiterId: string;
  message: string;
  candidateId: string;
  jobsId: string;
  position: number;
  messageType: string;
  phoneTo: string;
  updatedAt: string;
  createdAt: string;
  id: string;
  name: string;
  phoneFrom: string;
  messageObj: any;
  whatsappDeliveryStatus: string;
  cursor?: string;
}

export interface chatMessageType {
  messages: { [x: string]: any }[];
  phoneNumberFrom: string; // TODO: Rename to messageFrom for clarity
  phoneNumberTo: string; // TODO: Rename to messageTo for clarity
  messageType: string;
}

export interface SendWhatsappUtilityMessageObjectType {
  discussionDate?: string | '';
  nextStep?: string | '';
  availableDate?: string | '';
  template_name: string | '';
  recipient: string | '';

  candidateSource: string;
  recruiterName: string | '';
  recruiterFirstName: string | '';
  candidateFirstName: string | '';
  recruiterJobTitle: string | '';
  recruiterCompanyName: string | '';
  recruiterCompanyDescription: string | '';
  descriptionOneliner: string | '';
  companyName: string | '';
  jobPositionName: string | '';
  videoInterviewLink: string;
  jobCode: string | '';
  jobLocation: string | '';
}

export interface WhatsAppMessagesEdge {
  node: MessageNode;
}


export interface videoInterview {
  edges: videoInterviewEdge[];
}

export interface videoInterviewEdge {
  node: videoInterviewNode;
}

export interface videoInterviewNode {
  updatedAt: string | number | Date;
  id: string;
  interviewLink: InterviewLink;
  interviewCompleted: boolean;
  interviewStarted: boolean;
}

export interface InterviewLink {
  primaryLinkLabel: string;
  primaryLinkUrl: string;
}


// export interface Candidate {
//   stopChat: any;
//   startVideoInterviewChat: any;
//   startChatCompleted: any;
//   updatedAt: string | number | Date;
//   candConversationStatus: string;
//   startMeetingSchedulingChat: any;
//   videoInterview?: videoInterview;
//   id: string;
//   name: string;
//   startChat: boolean;
//   jobs: Jobs;
//   people: {
//     id: string;
//     name: {
//       firstName: string;
//       lastName: string;
//     };
//   };
// }

export interface CandidateNode {
  updatedAt: string | number | Date;
  videoInterview: videoInterview;
  whatsappProvider: string | 'application03';
  name: string;
  source?: string;
  campaign?: string;
  remarks?: string;
  jobTitle?: string;

  jobCompanyName?: string;
  messagingChannel?: string;
  attachments: any;
  id: string;
  engagementStatus: boolean;
  startVideoInterviewChat: boolean;
  startMeetingSchedulingChat: boolean;
  lastEngagementChatControl: chatControlType;
  phoneNumber: {primaryPhoneNumber:string};
  email: {primaryEmail:string};
  chatCount: number;
  
  createdAt: string | number | Date;
  input: string;
  candConversationStatus?: string;
  startChat: boolean;
  stopChat: boolean;
  status: string;
  whatsappMessages: WhatsAppMessages;
  emailMessages: EmailMessages;
  jobs: Job;
  jobsId?: string;
  peopleId: string;
  candidateFieldValues: CandidateFieldValues;
  candidateReminders: Reminders;
  clientInterview?: ClientInterviews;
  people: PersonNode;
  startChatCompleted?: boolean;
  startMeetingSchedulingChatCompleted?: boolean;
  startVideoInterviewChatCompleted?: boolean;
  hiringNaukriUrl?: {"primaryLinkUrl":string};
  resdexNaukriUrl?: {"primaryLinkUrl":string};
  linkedinUrl?: {"primaryLinkUrl":string};
}

// export interface Candidate {
//   updatedAt: string | number | Date;
//   videoInterview: videoInterview;
//   whatsappProvider: string | 'application03';
//   name: string;
//   source?: string;
//   campaign?: string;
//   messagingChannel?: string;
//   id: string;
//   engagementStatus: boolean;
//   startVideoInterviewChat: boolean;
//   startMeetingSchedulingChat: boolean;
//   lastEngagementChatControl: chatControlType;
//   phoneNumber: string;
//   email: string;
//   input: string;
//   candConversationStatus?: string;
//   startChat: boolean;
//   stopChat: boolean;
//   status: string;
//   whatsappMessages: WhatsAppMessages;
//   emailMessages: EmailMessages;
//   jobs: Jobs;
//   candidateFieldValues: CandidateFieldValues;
//   candidateReminders: Reminders;
//   clientInterview?: ClientInterviews;
//   people: PersonNode;
// }

export interface CandidateFieldValues {
  edges: CandidateFieldValueEdge[];
}

export interface CandidateFieldValueEdge {
  node: CandidateFieldValueNode;
}

export interface CandidateFieldValueNode {
  id: string;
  name: string;
  candidateFields: CandidateField;
  // fieldValueJSON: any;
}

export interface CandidateField {
  name: string;
  id: string;
}






// export interface ArxJobs {
//   name: string;
//   id: string;
//   recruiterId: string;
//   // companies: Companies;
//   jobLocation: string;
//   // whatsappMessages: WhatsAppMessages;
// }

export interface Reminders {
  edges: ReminderEdge[];
}

export interface ReminderEdge {
  node: ReminderObject;
}

export interface ReminderObject {
  remindCandidateAtTimestamp: string;
  remindCandidateDuration: string;
  isReminderActive: boolean;
  name: string;
  id: string;
}

export interface EmailMessages {
  edges: EmailMessagesEdge[];
}

export interface EmailMessagesEdge {
  node: EmailMessageNode;
}

export interface EmailMessageNode {
  id: string;
  email: string;
  text: string;
  subject: string;
  recruiterId: string;
  candidateId: string;
  jobsId: string;
  // messageType: string;
  messageThreadId: string;
  receivedAt: string;

  updatedAt: string;
  createdAt: string;
}

export interface CandidatesEdge {
  node: CandidateNode;
}

export interface Candidates {
  edges: CandidatesEdge[];
}

export interface PersonEdge {
  node: PersonNode;
}

export interface People {
  edges: PersonEdge[];
}

export interface RootObject {
  people: People;
}

export interface ChatRequestBody {
  phoneNumberFrom: string;
  phoneNumberTo: string;
  messages: string; // Adjust the type according to the structure of 'messages'
}

export interface companyInfoType {
  name: string;
  companyId: string;
  descriptionOneliner: string;
  id: string;
  domainName: {"primaryLinkUrl":string};
}

export interface company {
  name: string;
  companyId?: string;
  descriptionOneliner?: string;
  id: string;
  domainName: {"primaryLinkUrl":string};
}

export interface jobProfileType {
  name: any;
  jobLocation: string;
  id: string;
  recruiterId: string;
  company: companyInfoType;
}


export interface InterviewSchedules {
  edges: InterviewScheduleEdge[];
}


export interface JobEdge {
  node: Job;
}





/** Default delay (minutes) after last message before processing engagement. Used when job has no engagementProcessingDelayMinutes set. */
export const DEFAULT_ENGAGEMENT_PROCESSING_DELAY_MINUTES = 2;

export interface Job {
  chatFlowOrder?: chatControlType[]; // Array defining the order for this job
  /** Delay in minutes after last message before processing from queue. Recruiter-configurable per job. */
  engagementProcessingDelayMinutes?: number;
  /** Target spacing when batching start-chats: total window uses n × this value (minutes), capped by startChatMaxSpreadMinutes. Default 1. */
  startChatSpreadMinutesPerMessage?: number;
  /** Max minutes from first to last start-chat in a batch. Default 120. */
  startChatMaxSpreadMinutes?: number;
  name: string;
  id: string;
  recruiterId: string;
  companyDetails?: string;
  jobLocation: string;
  jobCode: string;
  company: company;
  createdAt?: string;
  updatedAt?: string;
  interviewSchedule?: InterviewSchedules;
  isActive: boolean;
  whatsappMessages: WhatsAppMessages;
  arxenaSiteId?: string;
  googleSheetId?: string;
  salaryBracket?: string;
  yearsOfExperience?: string;
  description?: string;
}

export interface InterviewScheduleEdge {
  node: InterviewSchedule;
}

export interface InterviewSchedule {
  meetingType: string;
  jobId: string;
  id: string;
  slotsAvailable: any;
  interviewTime: InterviewTime;
}

interface Entry {
  id: string;
  changes: any[];
}

export interface WhatsAppBusinessAccount {
  object: string;
  entry: Entry[];
}

export interface Attachment {
  __typename: string;
  whatsappMessageId: string | null;
  authorId: string | null;
  candidateId: string | null;
  fullPath: string;
  personId: string | null;
  name: string;
  opportunityId: string | null;
  cvsSentId: string | null;
  updatedAt: string;
  createdAt: string;
  jobId: string | null;
  type: string;
  companyId: string | null;
  screeningId: string | null;
  clientInterviewId: string | null;
  id: string;
  recruiterInterviewId: string | null;
  activityId: string | null;
  offerId: string | null;
  questionId: string | null;
  answerId: string | null;
}

export interface Question {
  attachments: any;
  id: string;
  name: string;
  timeLimit: number;
  questionType: string;
  createdAt: string;
  questionValue: string;
}

export const emptyInterviewData: InterviewData = {
  recruiterProfile: {
    companyName: '',
    companyDescription: '',
    firstName: '',
    lastName: '',
    name: '',
    email: '',
    phoneNumber: '',
    jobTitle: '',
    id: ''
  },
  id: '',
  name: '',
  candidate: {
    id: '',
    jobs: {
      id: '',
      name: '',
      recruiterId: '',
      companyName: '',
    },
    peopleId: '',
    name: '',
    email: {primaryEmail:''},
    phoneNumber: {primaryPhoneNumber:''},
  },
  videoInterview: {
    id: '',
    name: '',
    introduction: '',
    instructions: '',
    videoInterviewQuestions: {
      edges: [],
    },
  },
};

  export interface RecruiterProfileType {
    id: string;
    jobTitle: string;
    companyName: string;
    companyDescription: string;
    linkedinUrl?:string;
    /** Workspace member profile: stored Unipile account id for LinkedIn (matches findWorkspaceMemberProfiles). */
    linkedinUnipileAccountId?: string | null;
    /** Workspace member profile: stored Unipile account id for WhatsApp (matches findWorkspaceMemberProfiles). */
    whatsappUnipileAccountId?: string | null;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    phoneNumber: string;
    workspaceMember?: {
      id: string;
      userEmail: string;
      name:{
        firstName: string;
        lastName: string;
      }
    };
    workspaceMemberId?: string;
  }

export interface InterviewDataJobTemplate {
  job: Job;
  videoInterviewTemplate: {
    videoInterviewQuestions: {
      edges: Array<{
        node: videoInterviewQuestion;
      }>;
    };
  };
}

export interface InterviewData {
  recruiterProfile: RecruiterProfileType;
  id: string;
  name: string;
  candidate: {
    id: string;
    jobs: {
      id: string;
      recruiterId: string;
      name: string;
      companyName: string;
    };
    peopleId: string;
    name: string;
    email: {primaryEmail:string};
    phoneNumber: {primaryPhoneNumber:string};
  };
  videoInterview: {
    id: string;
    name: string;
    introduction: string;
    instructions: string;
    videoInterviewQuestions: {
      edges: Array<{
        node: Question;
      }>;
    };
  };
}

export interface Question {
  id: string;
  name: string;
  questionValue: string;
  timeLimit: number;
}

export interface VideoInterviewAttachment {
  data: any;
  id: string;
  fullPath: string;
  name: string;
}

export interface GetInterviewDetailsResponse {
  responseFromInterviewRequests: InterviewData;
  videoInterviewAttachmentResponse: VideoInterviewAttachment;
  questionsAttachments: VideoInterviewAttachment[];
}

export interface InterviewPageProps {
  InterviewData: InterviewData;
  questions: Question[];
  introductionVideoAttachment: VideoInterviewAttachment;
  questionsVideoAttachment: VideoInterviewAttachment[];
  currentQuestionIndex: number;
  onNextQuestion: (responseData: FormData) => void;
  onFinish: () => void;
}

export interface StartInterviewPageProps {
  onStart: () => void;
  InterviewData: InterviewData;
  introductionVideoData: VideoInterviewAttachment;
}

interface videoInterviewResponse {
  id: string;
  transcript: string | null;
  videoInterviewQuestionId: string;
  attachments: {
    edges: Array<{
      node: Attachment;
    }>;
  };
}

interface videoInterviewQuestion {
  id: string;
  questionValue: string;
  timeLimit: number | null;
  videoInterviewResponses: {
    edges: Array<{
      node: videoInterviewResponse;
    }>;
  };
}

export interface JobNode {
  node: {
    id: string;
    name: string;
  };
}

export interface VideoInterviewResponseViewerProps {
  candidateId?: string;
  videoInterviewId?: string;
}




// types.ts

export interface LinkedinSignupProps {
  /** Callback when signup is completed successfully */
  onSignupComplete?: (data: LinkedinSignupCompleteData) => void;
  /** Callback when signup is cancelled */
  onSignupCancel?: (currentStep: string) => void;
  /** Callback when an error occurs during signup */
  onSignupError?: (error: Error) => void;
}

export interface LinkedinSignupCompleteData {
  accountId?: string;
  username?: string;
  status?: 'connected' | 'pending' | 'error';
  profileData?: LinkedinProfileData;
}

export interface LinkedinCredentials {
  username: string;
  password: string;
}

export interface LinkedinCookieAuth {
  access_token: string;
  user_agent: string;
}

export interface LinkedinProfileData {
  id?: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  headline?: string;
  location?: string;
}

export interface LinkedinSignupResponse {
  success: boolean;
  data?: {
    account_id: string;
    provider: 'LINKEDIN';
    status: string;
    profile?: LinkedinProfileData;
  };
  error?: string;
}

export interface LinkedinCheckpointData {
  account_id: string;
  provider: 'LINKEDIN';
  code: string;
}

export interface UnipileLinkedinAccount {
  id: string;
  provider?: 'LINKEDIN';
  username: string;
  name?: string;
  type?: string;
  status: 'connected' | 'disconnected' | 'pending' | 'checkpoint_required';
  created_at?: string;
  updated_at?: string;
  connection_params?: any;
  sources?: any[];
  groups?: any[];
  profile_data?: LinkedinProfileData;
}

export interface LinkedinAuthMethod {
  type: 'credentials' | 'cookie' | 'hosted';
  data: LinkedinCredentials | LinkedinCookieAuth | {};
}

export interface UnipileWhatsappAccount {
  id: string;
  provider?: 'WHATSAPP';
  username: string;
  name?: string;
  phone_number?: string;
  type?: string;
  status: 'connected' | 'disconnected' | 'pending' | 'checkpoint_required' | 'connecting';
  created_at?: string;
  updated_at?: string;
  connection_params?: any;
  sources?: any[];
  groups?: any[];
}

export interface WhatsappQrCodeResponse {
  success?: boolean;
  qrCodeString: string;
  code: string;
  account_id?: string;
}

