export enum ClientDecision {
  SCHEDULE_INTERVIEW,
  CONDUCT_ASSESSMENT,
  REJECT,
  HOLD_FOR_CURRENT_PROCESS,
  HOLD_FOR_FUTURE_PROCESS,
  CONSIDER_FOR_OTHER_ROLES
}


export interface Reference {

  id: string;
  candidateId: string;
  name: string;

  contactInfo: string;

}


export interface ReferenceFeedback {

  referenceId: string;
  candidateId: string;
  feedback: string;
  rating?: number;

}

export enum CandidateDecision {
  DECLINE_INTERVIEW,
  ACCEPT_INTERVIEW,
  DECLINE_JOINING,
  ACCEPT_JOINING,
  REQUEST_EXTENSION_ON_JOINING,
  ACCEPT_OFFER,
  REJECT_OFFER,
  COUNTER_OFFER,
  REQUEST_EXTENSION,
  REQUEST_MORE_TIME
}


export interface SalaryDocument {

  documentId: string;

  documentType: string;

  documentUrl: string;
  parsedDocument: string;

}


export enum CandidateFollowUpStage {

  BEFORE_CV_SHARE,

  AFTER_CV_SHARE,

  BEFORE_INTERVIEW,

  AFTER_INTERVIEW

}



export enum RecruiterDecision {
  HOLD_FOR_BETTER_CANDIDATES,
  CAN_SHARE_WITH_CLIENT,
  SHORTLIST,
  SHARE_PROFILE,
  REJECT,
  HOLD_FOR_FUTURE_PROCESS
}

export interface ClientFeedback {
  stakeholderId: string;
  rating: number;
  timestamp: Date;
  comments: string;
  decision: ClientDecision; // Add this line

  skillAssessment: Map<string, number>;
  interestLevel: 'high' | 'medium' | 'low';
  nextSteps?: string;
 }
 

export enum ActionType {
  UPLOAD_DOCUMENT,
  SCHEDULE_INTERVIEW,
  COMPLETE_ASSESSMENT,
  PROVIDE_FEEDBACK,
  APPROVE_OFFER,
  UPDATE_INFORMATION
 }
 
// Types and Interfaces

export interface Task {
  id: string;
  title: string;
  deadline: Date;
  status: TaskStatus;
  assignedTo: string[];
  description: string;
  dueDate: Date;
  dependsOn?: string[];
  priority: 'low' | 'medium' | 'high';
  notifications: NotificationPreference[];
 }


export enum TaskStatus {

  PENDING = 'PENDING',

  COMPLETED = 'COMPLETED',

  IN_PROGRESS = 'IN_PROGRESS'

}


export interface ClientResponse {
  stakeholderId: string;
  shareId: string;
  candidateId: string;
  decision: ClientDecision;
  details: InterviewRequest | AssessmentRequest | RejectionDetails;
}



export interface RejectionDetails {
  reason: string;
  feedback: string;
  possibleFutureMatch?: boolean;
}

export interface AssessmentRequest {
  type: Assessment[];
  deadline: Date;
  priority: 'high' | 'medium' | 'low';
}




export interface ShareAnalytics {

  totalViews: number;

  uniqueViewers: number;

  averageViewDuration: number;

  stakeholderEngagement: number;

  timeToFirstView: number | null;

  timeToFeedback: number | null;

}

  
export interface NotificationContent {
    subject: string;
    candidateId: string;
    shareId: string;
    clientId: string;
    recruiterId: string;
    message: string;
    interview?: Interview; // Add this line

  }
  
  export enum InterviewStatus {
    SCHEDULED = 'scheduled',
    COMPLETED = 'completed',
    RESCHEDULED = 'rescheduled',
    CANCELLED = 'cancelled'
  }

export interface Interview {
    id: string;
    candidateId: string;
    clientId: string;
    round: number;
    scheduledTime: Date;
    duration: number;
    mode: InterviewMode;

    status: InterviewStatus;

    feedback: Feedback;
  }


  export enum InterviewMode {
    ONLINE = 'online',
    ONSITE = 'onsite'
  }

export interface ReminderSchedule {

  initial: Date;

  reminders: Date[];

  final: Date;

}

export  enum NotificationType {
    STATUS_CHANGE,
    NEW_CV_SHARED,
    CV_FEEDBACK_RECEIVED,
    INTERVIEW_SCHEDULED,
    CANDIDATE_REJECTED,
    OFFER_INITIATED,
    PROFILE_ON_HOLD,
    CANDIDATE_UNAVAILABLE,
    FOLLOW_UP,
    PRELIMINARY_OFFER,
    FINAL_OFFER,
    OFFER_ACCEPTANCE,
    SALARY_DOCUMENT_REQUEST,
    REFERENCE_FEEDBACK,
    CURRENT_SALARY,
    REFERENCE_REQUEST,
    JOINING_DATE_SET,
    CONGRATULATIONS,
    OFFER_REJECTED,
    REQUEST_MORE_TIME
  }
  
export interface RecruitmentEvent {
    type: any;
    eventType: string;
    timestamp: Date;
    details: string | RejectionDetails | Assessment | Interview;

    candidateId: string;
  }
  
export interface Client {
    stakeholders: any;
    id: string;
    name: string;
    industry: string;
    feedback: Feedback[];
  }
  
export interface Recruiter {
    id: string;
    name: string;
    email: string;
    phone: string;
  }
  
export interface Feedback {
    rating: number;
    comments: string;
  }
  

export interface InterviewRequest {
  candidateId: string;
  interviewers: string[];
  round: number;
  dateTimeStart: Date;
  dateTimeEnd: Date;
  duration: number;
  mode: 'online' | 'onsite';
  preferredSlots: TimeSlot[];
  specialRequirements?: string[];
  }
  
export interface Interview {
    id: string;
    date: Date;
    interviewRequest: InterviewRequest;
    feedback: Feedback;
  }
  
export interface Assessment {
    id: string;
    type: string;
    request: AssessmentRequest;
    status: AssessmentStatusType;
    createdAt: Date;
    result: string;
  }
  
export interface OfferDetails {
  baseSalary: number;
  bonus: number;
  benefits: string[];
  equity: number;
  totalCompensation: number;
  offerDate: Date;
  offeredCtc: number;
  joiningDate: Date;
}




export enum CandidateStatus {
  New,
  REJECTED_BY_RECRUITER,

  CANDIDATE_REFUSED,

  SHORTLISTED,

  REJECTED_BY_CLIENT,

  CLIENT_REVIEW,
  INTERVIEW_PROCESS,
  ASSESSMENT,
  SELECTED,
  REFERENCE_CHECK,
  SALARY_NEGOTIATION,
  OFFERED,
  OFFER_ACCEPTED,
  NOTICE_PERIOD,
  JOINED,
  UNAVAILABLE,
  ONBOARDING,
  OFFER,
  NEW,
  REJECTED
}




export interface OnboardingStatus {
  status: OnboardingStatusTypes;
  startDate: Date;
  endDate: Date;
  expectedEndDate: Date;
  documents: Document[];
  tasks: Task[];
  currentDuration: number;

}

export enum OnboardingStatusTypes {

  NOT_STARTED = 'NOT_STARTED',

  IN_PROGRESS = 'IN_PROGRESS',

  COMPLETED = 'COMPLETED'

}


  
export interface Candidate {
      joiningDate: Date;
      clientId: string;
      noticePeriod: number;
      currentCtc: number;
      expectedCtc: number;
      experience: number;
      skills: string[];
      name: string;
      currentStage: StageDetails;
      id: string;
      status: CandidateStatus;
      clientFeedback: Feedback[];
      interviews: Interview[];
      assessments: Assessment[];
      documents: Document[];
      offerDetails: OfferDetails;
      onboardingStatus: OnboardingStatus;
    }
    


export interface ClientStakeholder {
  id: string;
  role: ClientRole;
  permissions: StakeholderPermissions;
}

export enum ClientRole {
  HIRING_MANAGER,
  TECHNICAL_INTERVIEWER,
  HR_REPRESENTATIVE,
  DEPARTMENT_HEAD
}

export interface StakeholderPermissions {
  canProvideFeedback: boolean;
  canScheduleInterviews: boolean;
  canViewSalaryDetails: boolean;
  canApproveOffers: boolean;
  canViewDocuments: boolean;
}

export interface Action {
  id: string;
  type: ActionType;
  assignedTo: string;
  dueDate: Date;
  status: 'pending' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
 }
 
 
 export interface Milestone {
  id: string;
  title: string;
  completedDate: Date;
  associatedDocuments?: Document[];
  verifiedBy?: string;
 }


export  interface DelayRecord {
  startDate: Date;
  duration: number;
  reason: string;
  responsibleParty?: string;
  mitigationSteps?: string[];
  impact: 'low' | 'medium' | 'high';
 }
 
 export enum EventType {
  DOCUMENT_SUBMISSION,
  INTERVIEW_SCHEDULED,
  INTERVIEW_COMPLETED,
  FEEDBACK_RECEIVED,
  OFFER_MADE,
  OFFER_ACCEPTED,
  ASSESSMENT_COMPLETED,
  STATUS_CHANGE,
  DELAY_RECORDED,
  CANDIDATE_REJECTED,
  ASSESSMENT_INITIATED
 }
 
 export interface ContactInfo {
  email: string;
  phone?: string;
  preferredContactMethod: 'email' | 'phone';
  timeZone: string;
  alternateContact?: string;
 }

export  interface DailyAvailability {
  dayOfWeek: number; // 0-6 for Sunday-Saturday
  slots: TimeSlot[];
  isWorkingDay: boolean;
 }
 
 export interface TimeSlot {
  startTime: string; // 24hr format "HH:mm"
  endTime: string;
  status: 'available' | 'tentative' | 'blocked';
  recurrence?: 'daily' | 'weekly' | 'once';
 }
 
 export interface NotificationPreference {
  type: 'email' | 'sms' | 'push';
  frequency: 'instant' | 'daily' | 'custom';
  customSchedule?: {
    beforeDeadline: number; // hours
    reminderInterval: number; // hours
  };
  templates: {
    initial: string;
    reminder: string;
    urgent: string;
  };
 }
 
 export interface AvailabilitySchedule {
  weeklySchedule: DailyAvailability[];
  blockedDates: Date[];
  preferredTimes: TimeSlot[];
  nextAvailableSlot: Date;
 }
 
 export interface DocumentStatus {
  id: string;
  type: DocumentType;
  status: 'pending' | 'submitted' | 'verified' | 'rejected';
  submissionDate?: Date;
  verificationDate?: Date;
  expiryDate?: Date;
  remarks?: string;
 }
 


 export interface Step {
  id: string;
  title: string;
  description: string;
  expectedDuration: number;
  prerequisiteSteps: string[];
  requiredDocuments?: DocumentType[];
  stakeholderApprovals?: string[];
 }
 
 export interface StageTimeline {
  startDate: Date;
  expectedEndDate: Date;
  actualEndDate?: Date;
  
  events: TimelineEvent[];
  delays?: DelayRecord[];
  currentDuration: number;
 }
 
 export interface TimelineEvent {
  date: Date;
  type: EventType;
  description: string;
  stakeholders: string[];
  outcome?: string;
 }
 
 export interface StakeholderInfo {
  id: string;
  role: string;
  organization: string;
  responsibilityLevel: 'primary' | 'secondary';
  contactDetails: ContactInfo;
  availability?: AvailabilitySchedule;
 }

export interface StageDetails {
  status: CandidateStatus;
  currentSubStage: string;
  progress: number;
  stageDescription: string;
  stageName: string;
  stageDate: Date;
  pendingActions: Action[];
  completedMilestones: Milestone[];
  nextSteps: Step[];
  timeline: StageTimeline;
  stakeholders: StakeholderInfo[];
 }
 
export interface CandidateProfile {
  id: string;
  currentStage: StageDetails;
  upcomingTasks: Task[];
  documents: DocumentStatus[];
 }
 


 export interface FilterCriteria {
  status?: CandidateStatus[];
  skillTags?: string[];
  experienceRange?: { min: number; max: number };
  location?: string[];
  salaryRange?: { min: number; max: number };
  joiningTimeframe?: number; // in days
  interviewStage?: string;
 }
 
 export interface CandidateView {
  id: string;
  name: string;
  currentStatus: StageDetails;
  matchScore: number;
  keySkills: string[];
  experience: number;
  currentCtc: number;
  expectedCtc: number;
  noticePeriod: number;
  lastActivity: TimelineEvent;
  pendingActions: Action[];
 }
 

 
 export interface Report {
  id: string;
  type: ReportType;
  dateRange: { start: Date; end: Date };
  metrics: ReportMetric[];
  visualizations: ChartData[];
  insights: string[];
 }
 
export enum ReportType {
  PIPELINE_METRICS,
  TIME_TO_FILL,
  CONVERSION_RATES,
  STAKEHOLDER_ENGAGEMENT,
  COST_ANALYSIS,
  CANDIDATE_SOURCE
 }
 
 export interface ClientEngagementMetrics {
  averageResponseTime: number;
  feedbackCompletionRate: number;
  interviewAttendanceRate: number;
  documentTurnaroundTime: number;
  stakeholderParticipation: Map<string, ParticipationScore>;
  bottlenecks: BottleneckAnalysis[];
 }



 export interface BottleneckAnalysis {
  stage: CandidateStatus;
  averageDelayDuration: number;
  impactedCandidates: number;
  rootCauses: {
    cause: string;
    frequency: number;
    impact: number;
  }[];
  suggestedActions: string[];
 }
 
 export interface ParticipationScore {
  responseRate: number;
  averageEngagementTime: number;
  decisionsPerWeek: number;
  feedbackQuality: number; // 0-100
  bottleneckFrequency: number;
 }
 
 export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'scatter';
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
  options?: ChartOptions;
 }
 
 export interface ReportMetric {
  name: string;
  value: number;
  trend: number;
  benchmark?: number;
  unit: string;
  comparison: 'positive' | 'neutral' | 'negative';
 }

export enum DocumentType {
  RESUME,
  COVER_LETTER,
  ID_PROOF,
  EDUCATION_CERTIFICATES,
  WORK_EXPERIENCE_CERTIFICATES,
  REFERENCE_LETTERS,
  SALARY_SLIP
 }
 export interface ChartOptions {
  responsive: boolean;
  animation: {
    duration: number;
    easing: string;
  };
  scales: {
    x: AxisOptions;
    y: AxisOptions;
  };
  plugins: {
    legend: {
      position: 'top' | 'bottom' | 'left' | 'right';
      display: boolean;
    };
    tooltip: {
      enabled: boolean;
      mode: 'point' | 'nearest' | 'index' | 'dataset';
    };
  };
  layout: {
    padding: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
 }
 
 export interface AxisOptions {
  display: boolean;
  title: {
    text: string;
    display: boolean;
  };
  grid: {
    display: boolean;
    color: string;
  };
  ticks: {
    autoSkip: boolean;
    maxRotation: number;
  };
 }

export function NotificationService(NotificationService: any, arg1: string) {
    throw new Error('Function not implemented.');
}



interface CandidateNotifications {
  documentRequests: Document[];
  interviewSchedules: Interview[];
  assessmentDeadlines: Assessment[];
  offerUpdates: OfferStatus;
  nextSteps: Task[];
 }


 export interface InterviewSchedule {

  // Define the structure of InterviewSchedule

  upcomingInterviews: string[];

  rescheduleRequests: string[];

  feedbackSubmission: string[];

}


 export interface CandidateManagementSystem {
  candidates: Map<string, Candidate>;
  clientStakeholders: Map<string, ClientStakeholder>;
  shortlistingManager: ShortlistingManager;
  clientReviewManager: ClientReviewManager;
  interviewManager: InterviewManager;
  assessmentManager: AssessmentManager;
  offerManager: OfferManager;
  notificationService: NotificationService;
  candidateNotifications: CandidateNotifications;
 }

export interface ShortlistingManager {
  shortlistCandidate(candidateId: string): void;
  shareWithClient(candidateId: string, clientId: string): void;
 }

export interface ClientReviewManager {
  submitClientFeedback(candidateId: string, feedback: Feedback): void;
  getCandidateFeedback(candidateId: string): void;
 }

export interface InterviewManager {
  scheduleInterview(
    candidateId: string,
    clientId: string,
    round: number
  ): Interview;
  rescheduleInterview(
    interviewId: string,
    newTime: Date
  ): Interview;
  cancelInterview(interviewId: string): void;
 }


export interface AssessmentManager {
  initiateAssessment(candidateId: string): Assessment;
  completeAssessment(assessmentId: string): void;
  trackAssessmentProgress(assessmentId: string): void;
 }


 export interface Availability {

  date: Date;

  startTime: string;

  endTime: string;

}

 export enum AssessmentStatusType {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue'
}


 export interface AssessmentStatus {
  id: string;
  candidateId: string;
  status: AssessmentStatusType;
  type: string;
  deadline: Date;
  result: string;
 }

export interface OfferManager {
  collectDocuments(arg0: string): unknown;
  initiateOffer(candidateId: string): OfferStatus;
  updateOfferDetails(offerId: string, details: OfferDetails): void;
  approveOffer(offerId: string): void;
  rejectOffer(offerId: string): void;
  withdrawOffer(offerId: string): void;
 }


export interface NotificationService {
  sendNotification(
    recipient: string,
    content: NotificationContent,
    type: NotificationType
  ): void;
  scheduleNotification(
    recipient: string,
    content: NotificationContent,
    type: NotificationType,
    schedule: Date
  ): void;
 }


export interface Document {
  id: string;
  type: DocumentType;
  link: string;
  uploadedAt: Date;
  uploadedBy: string;
  status: 'pending' | 'submitted' | 'verified' | 'rejected';
  remarks?: string;
 }


export interface OfferStatus {
  canProceed(canProceed: any): unknown;
  id: string;
  candidateId: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  details: OfferDetails;
  approvalChain: string[];
 }


export interface CandidateManagementSystem {
  candidates: Map<string, Candidate>;
  clientStakeholders: Map<string, ClientStakeholder>;
  shortlistingManager: ShortlistingManager;
  clientReviewManager: ClientReviewManager;
  interviewManager: InterviewManager;
  assessmentManager: AssessmentManager;
  offerManager: OfferManager;
  notificationService: NotificationService;
  candidateNotifications: CandidateNotifications;
 }



 export interface CV {
  id: string;
  candidateId: string;
  version: number;
  format: 'pdf' | 'doc' | 'docx';
  url: string;
  isAnonymized: boolean;
  highlights: string[];
  lastModified: Date;
  customizations: CVCustomization[];
 }
 
 export interface CVCustomization {
  clientId: string;
  modifications: {
    hidePersonalInfo: boolean;
    emphasizedSkills: string[];
    hiddenDetails: string[];
    reorderedSections: string[];
  };
 }
 
 export interface CVShare {
  share: { stakeholderId: string; decision: ClientDecision; timestamp: Date; };
  id: string;
  cvId: string;
  candidateId: string;
  clientId: string;
  recruiterId: string;
  sharedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'viewed' | 'feedback_received';
  viewHistory: ViewRecord[];
  feedback?: ClientFeedback;
 }
 
 export interface ViewRecord {
  stakeholderId: string;
  viewedAt: Date;
  duration: number;
 }
 
