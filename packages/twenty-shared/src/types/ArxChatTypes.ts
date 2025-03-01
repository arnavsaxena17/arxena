
// Define the possible roles in the chat
export type ChatRole = "system" | "user" | "tool" | "assistant";

// Interface for chat message without tool call
export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  name?: string; // Optional, only for tool messages
}

export interface ChatTableProps {
  individuals: PersonNode[];
  selectedIndividual: string;
  unreadMessages: UnreadMessageListManyCandidates;
  onIndividualSelect: (id: string) => void;
  onSelectionChange?: (selectedIds: string[]) => void;

}
export interface JobDropdownProps {
  jobs: Job[];
  selectedJob: string;
  onJobChange: (jobId: string) => void;
}


export interface Job {
  node:{

    id: string;
    name: string;
  }
}

export interface Name {
  firstName: string | '',
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
  type: 'string' | 'number' | 'date' | 'enum' | 'boolean' | 'array' | 'url' | 'object';
  enum?: any;
  format?: (value: any) => string;
}
export interface ProcessCandidatesJobData {
  data: UserProfile[];
  jobId: string;
  jobName: any;
  batchName?: string;
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
    type: 'number',
    format: (value: number) => (value ? value.toFixed(1) : '0'),
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
    format: (value: string) => value || '',

  },
  {
    key: 'education_institute_ug',
    header: 'UG Institute',
    type: 'string',
    format: (value: string) => value || '',

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
    format: (value: string) => value || '',

  },
  {
    key: 'education_institute_pg',
    header: 'PG Institute',
    type: 'string',
    format: (value: string) => value || '',

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
    format: (value: string) => value || '',
  },
  {
    key: 'notes',
    header: 'Notes',
    type: 'string',
    format: (value: string) => value || '',
  },
  {
    key: 'unique_key_string',
    header: 'UniqueKey',
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
    key: 'english_level',
    header: 'English Proficiency',
    type: 'object',
    format: (value: { level: string; description: string }) => value?.level || '',
  },
  {
    key: 'experience_departments',
    header: 'Experience Departments',
    type: 'array',
    format: (value: string[]) => (Array.isArray(value) ? value.join('; ') : ''),
  },
  {
    key: 'preferred_locations',
    header: 'Preferred Locations',
    type: 'array',
    format: (value: string[]) => (Array.isArray(value) ? value.join('; ') : ''),
  },
  {
    key: 'may_also_know',
    header: 'Related Skills',
    type: 'array',
    format: (value: string[]) => (Array.isArray(value) ? value.join('; ') : ''),
  },
  {
    key: 'is_fresher',
    header: 'Is Fresher',
    type: 'boolean',
    format: (value: boolean) => (value ? 'Yes' : 'No'),
  },
  {
    key: 'is_experienced',
    header: 'Is Experienced',
    type: 'boolean',
    format: (value: boolean) => (value ? 'Yes' : 'No'),
  },
  {
    key: 'active_on',
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
    key: 'is_cv_attached',
    header: 'CV Attached',
    type: 'boolean',
    format: (value: boolean) => (value ? 'Yes' : 'No'),
  },
  {
    key: 'is_profile_purchased',
    header: 'isProfilePurchased',
    type: 'boolean',
    format: (value: boolean) => (value ? 'Yes' : 'No'),
  },
  {
    key: 'profile_photo_url',
    header: 'Profile Photo URL',
    type: 'url',
    format: (value: string) => value || '',
  },
  {
    key: 'english_audio_intro_url',
    header: 'English Audio Intro URL',
    type: 'url',
    format: (value: string) => value || '',
  },
  {
    key: 'highest_education_level',
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
// interface Candidate {
//   name: string;
//   personId: string;
//   status: string;
//   engagementStatus: boolean;
//   startChat: boolean;
//   whatsappProvider: string;
// }

// Define the onePersonObject interface
interface Person {
  //   id: string;
  name: {
    firstName: string;
    lastName: string;
  };
  linkedinLink: 
    { primaryLinkLabel: string; primaryLinkUrl: string }
  jobTitle: string;
}

export interface ArxenaCandidateNode {
  name: string;
  engagementStatus: boolean;
  startChat: boolean;
  phoneNumber:{ primaryPhoneNumber: string; }
  email:{ primaryEmail: any; }
  campaign:string
  source:string
  startVideoInterviewChat: boolean;
  startMeetingSchedulingChat: boolean;
  uniqueStringKey: string;
  stopChat: boolean;
  hiringNaukriUrl?: { primaryLinkLabel: string; primaryLinkUrl: string };
  resdexNaukriUrl?: { primaryLinkLabel: string; primaryLinkUrl: string };
  displayPicture: { primaryLinkLabel: string; primaryLinkUrl: string };
  jobsId: string;
  jobSpecificFields: any;
  peopleId: string;
}

export interface ArxenaJobCandidateNode {
  id?: string;
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
  emails : { primaryEmail: string };
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
  linkedinLink?: { primaryLinkLabel: string; primaryLinkUrl: string }
  displayPicture?: { primaryLinkLabel: string; primaryLinkUrl: string }
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

export interface Jobs {
  googleSheetId?: string;
  name: string;
  id: string;
  isActive: boolean;
  recruiterId: string;
  jobLocation: string;
  arxenaSiteId?: string;
}

// Interface for chat message with tool call
export interface ToolChatMessage {
  tool_call_id: string;
  name: string; // Required for tool messages
  role: ChatRole;
  content: string;
}

// Type for chat history items
export type ChatHistoryItem = ChatMessage | ToolChatMessage;


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
  baileysMessageId:string;
  fromName: string;
  phoneNumberTo: string;
}

export interface whatappUpdateMessageObjType {
  // executorResultObj: ChainValues;
  messageObj: ChatHistoryItem[];
  candidateProfile: CandidateNode;
  candidateFirstName: string;
  messages: { [x: string]: any }[];
  phoneNumberFrom: string;
  phoneNumberTo: string;
  messageType: string;
  whatsappDeliveryStatus: string;
  whatsappMessageType:string;
  lastEngagementChatControl:string

  whatsappMessageId: string;
  type?: string;
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


export interface ClientInterviewNode{
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  clientInterviewCompleted:boolean
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
  phones: {"primaryPhoneNumber":string};
  emails: {"primaryEmail":string};
  suitabilityDescription?: string;
  salary:string;
  city:string;
  uniqueStringKey:  string;

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
  object: "whatsapp_business_account";
  entry: Entry[];
}


export const emptyCandidateProfileObj: CandidateNode = {
  name: '',
  id: '',
  whatsappProvider: '',
  jobs: {
    name: '',
    id: '',
    isActive: false,
    recruiterId: '',
    company: {
      name: '',
      companyId: '',
      domainName: '',
      descriptionOneliner: '',
    },
    jobLocation: '',
    jobCode: "",
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
            whatsappDeliveryStatus: ''
          },
        },
      ],
    },
  },
  videoInterview: {
    edges: [
      {
        node: {
          id: '',
          interviewLink: {
            primaryLinkLabel: '',
            primaryLinkUrl: ''
          },
          updatedAt: '',
          interviewCompleted: false,
          interviewStarted: false
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
  status: '',
  engagementStatus: false,
  phoneNumber: '',
  email: '',
  input: '',
  startChat: false,
  candConversationStatus: '',
  startMeetingSchedulingChat: false,
  lastEngagementChatControl: 'startChat' as chatControlType,
  startVideoInterviewChat: false,
  stopChat: false,
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
          whatsappDeliveryStatus: ''
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
  person: {
    phones: { primaryPhoneNumber: '' },
    emails: { primaryEmail: '' },
    jobTitle: '',
    id: '',
    position: 0,
    uniqueStringKey: '',
    name: {
      firstName: '',
      lastName: ''
    },
    candidates: {
      edges: []
    },
    salary: '',
    city: ''
  }
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
    }
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
    }
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
    relationType?: "ONE_TO_MANY" | "ONE_TO_ONE" | "MANY_TO_ONE" | "MANY_TO_MANY";
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

export type FieldType = "SELECT" | "DATE_TIME" | "TEXT" | "NUMBER" | "BOOLEAN" | "LINKS" | "RAW_JSON" | "EMAILS" | "PHONES";

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


export interface EnrichmentField {
    name: string;
    type: string;
    description: string;
    id: number;
    enumValues?: string[];
}

export interface Enrichment {
    modelName: string;
    prompt: string;
    fields: EnrichmentField[];
    selectedMetadataFields: string[];
    selectedModel: string;
    bestOf?: number;
}




import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Define the possible roles in the chat





export const statusesArray = ['SCREENING', "INTERESTED", "NOT_INTERESTED", "NOT_FIT",'CV_SENT',"CV_RECEIVED",'RECRUITER_INTERVIEW','CLIENT_INTERVIEW','NEGOTIATION'] as const;

export type WhatsappMessageType = "messages" | "media"
export interface ChatControlNode {
  chatControlType: string;
  nextNodes: string[];
  conditions?: {
    nextNode: string;
    evaluator: (candidate: CandidateNode) => boolean;
  }[];
}
export const allStatusesArray: [string, ...string[]] = [
  "ONLY_ADDED_NO_CONVERSATION",
  "CONVERSATION_STARTED_HAS_NOT_RESPONDED",
  "SHARED_JD_HAS_NOT_RESPONDED",
  "CANDIDATE_REFUSES_TO_RELOCATE",
  "STOPPED_RESPONDING_ON_QUESTIONS",
  "CANDIDATE_SALARY_OUT_OF_RANGE",
  "CANDIDATE_IS_KEEN_TO_CHAT",
  "CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT",
  "CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION",
  "CANDIDATE_DECLINED_OPPORTUNITY",
  "CONVERSATION_CLOSED_TO_BE_CONTACTED",
];

export type allStatuses = typeof allStatusesArray[number];
export type statuses = typeof statusesArray[number];

export type chatControlType = "startChat" | "allStartedAndStoppedChats" | "startVideoInterviewChat" | "startMeetingSchedulingChat";
export interface ChatControlsObjType {
  chatControlType: chatControlType;
  chatMessageTemplate?: string;
}



// Type for chat history items

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
}


export interface chatMessageType {
  messages: { [x: string]: any }[];
  phoneNumberFrom: string;
  phoneNumberTo: string;
  messageType: string;
}

export interface SendWhatsappUtilityMessageObjectType {
  discussionDate?: string | "";
  nextStep?: string | "";
  availableDate?: string | "";
  template_name: string | "";
  recipient: string | "";

  candidateSource:string;
  recruiterName: string | "";
  recruiterFirstName: string | "";
  candidateFirstName: string | "";
  recruiterJobTitle: string | "";
  recruiterCompanyName: string | "";
  recruiterCompanyDescription: string | "";
  descriptionOneliner:string | "";
  companyName: string | "";
  jobPositionName: string | "";
  videoInterviewLink: string;
  jobCode: string | "";
  jobLocation: string | "";
}

export interface WhatsAppMessagesEdge {
  node: MessageNode;
}


export interface Candidate {
  stopChat: any;
  startVideoInterviewChat: any;
  startChatCompleted: any;
  updatedAt: string | number | Date;
  candConversationStatus: string;
startMeetingSchedulingChat: any;
  videoInterview?: videoInterview;
  id: string;
  name: string;
  startChat: boolean;
  jobs: Jobs;
  people: {
    id: string;
    name: {
      firstName: string;
      lastName: string;
    };
  };
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
   primaryLinkLabel: string; primaryLinkUrl: string 
  };





export interface CandidateNode {
  updatedAt: string | number | Date;
  videoInterview: videoInterview;
  whatsappProvider: string | "application03";
  name: string;
  id: string;
  engagementStatus: boolean;
  startVideoInterviewChat: boolean;
  startMeetingSchedulingChat: boolean;
  lastEngagementChatControl: chatControlType;
  phoneNumber: string;
  email: string;
  input: string;
  candConversationStatus?:string;
  startChat: boolean;
  stopChat: boolean;
  status:string;
  whatsappMessages: WhatsAppMessages;
  emailMessages: EmailMessages;
  jobs: Jobs;
  candidateReminders: Reminders;
  clientInterview?: ClientInterviews;
  person : PersonNode
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
}

export interface company {
  domainName: any;
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
export interface Jobs {
  chatFlowOrder?: chatControlType[]; // Array defining the order for this job
  name: string;
  id: string;
  recruiterId: string;
  jobLocation: string;
  jobCode:string;
  company: company;
  createdAt?: string;
  interviewSchedule?: InterviewSchedules;
  isActive: boolean;
  whatsappMessages: WhatsAppMessages;
}

export interface InterviewSchedules {
  edges: InterviewScheduleEdge[];
}

export interface InterviewScheduleEdge {
  node: InterviewSchedule;
}


export interface InterviewSchedule{
  meetingType:string;
  jobId:string;
  id:string;
  slotsAvailable:any;
  interviewTime:any;

}




interface Entry {
  id: string;
  changes: any[];
}

export interface WhatsAppBusinessAccount {
  object: 'whatsapp_business_account';
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
    jobTitle: ''
  },
  id: '',
  name: '',
  candidate: {
    id: '',
    jobs: {
    jobId: '',
    name: '',
    recruiterId: '',
    companyName: '',
    },
    people: {
      id: '',
    name: {
      firstName: '',
      lastName: '',
    },
    email: '',
    phone: '',
    },
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
    jobTitle: string;
    companyName: string;
    companyDescription: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    phoneNumber: string;
  }
  



export interface InterviewData {
  recruiterProfile:RecruiterProfileType,
  id: string;
  name: string;
  candidate: {
    id: string;
    jobs: {
      jobId: string;
      recruiterId: string;
      name: string;
      companyName: string;
    };
    people: {
      id: string;
      name: {
        firstName: string;
        lastName: string;
      };
      email: string;
      phone: string;
    };
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

