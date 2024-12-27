import { share } from 'rxjs';
import * as deliveryManagementTypes from './types/delivery-management.types';
  // Core Components
  


  
export class CandidateManagementSystem {
    private candidates: Map<string, deliveryManagementTypes.Candidate>;
    clientStakeholders: deliveryManagementTypes.ClientStakeholder[];
    private clients: Map<string, deliveryManagementTypes.Client>;
    private recruiters: Map<string, deliveryManagementTypes.Recruiter>;
    private taskManagementSystem: TaskManagementSystem;
    private cvSharingManager: CVSharingManager;

    constructor() {
        this.candidates = new Map();
        this.clients = new Map();
        this.recruiters = new Map();
        this.taskManagementSystem = new TaskManagementSystem();
        this.initializeManagers();
        this.cvSharingManager = new CVSharingManager(
            this.candidates, 
            this.clients,
            this.eventTracker
          );
       
      this.eventTracker = new EventTrackingSystem();
    }

    private shortlistingManager: ShortlistingManager;
    private clientReviewManager: ClientReviewManager;
    private interviewManager: InterviewManager;
    private assessmentManager: AssessmentManager;
    private offerManager: OfferManager;
    private onboardingManager: OnboardingManager;
    private notificationService: NotificationService;
    private eventTracker: EventTrackingSystem;

    private initializeManagers(): void {
        this.shortlistingManager = new ShortlistingManager(this.candidates, this.clients);
        this.clientReviewManager = new ClientReviewManager(this.candidates, this.clients);
        this.interviewManager = new InterviewManager(this.candidates, this.clients);
        this.assessmentManager = new AssessmentManager(this.candidates);
        this.offerManager = new OfferManager(this.candidates, this.clients);
        this.onboardingManager = new OnboardingManager(this.candidates);
        this.notificationService = new NotificationService();
        this.eventTracker = new EventTrackingSystem();
    }

    // Candidate Management
    async addCandidate(candidate: deliveryManagementTypes.Candidate): Promise<string> {
        const id = generateUniqueId();
        this.candidates.set(id, {
            ...candidate,
            id,
            status: deliveryManagementTypes.CandidateStatus.SHORTLISTED,
            currentStage: this.initializeStage()
        });
        this.eventTracker.logEvent({
            type: deliveryManagementTypes.EventType.STATUS_CHANGE,
            candidateId: id,
            details: 'Candidate added to system',
            eventType: '',
            timestamp: new Date()
        });
        return id;
    }

    updateCandidateStatus(candidateId: string, status: deliveryManagementTypes.CandidateStatus): void {
        const candidate = this.candidates.get(candidateId);
        if (!candidate) throw new Error('Candidate not found');

        candidate.status = status;
        candidate.currentStage = this.createStageDetails(status);
        this.notifyStatusChange(candidateId, status);
    }

    // Client Management
    addClient(client: deliveryManagementTypes.Client): string {
        const id = generateUniqueId();
        this.clients.set(id, { ...client, id });
        return id;
    }

    addClientStakeholder(clientId: string, stakeholder: deliveryManagementTypes.ClientStakeholder): void {
        const client = this.clients.get(clientId);
        if (!client) throw new Error('Client not found');
        client.stakeholders.push(stakeholder);
    }

    // Pipeline Management
    getCandidatePipeline(filters: deliveryManagementTypes.FilterCriteria): deliveryManagementTypes.CandidateView[] {
        return Array.from(this.candidates.values())
            .filter(candidate => this.applyFilters(candidate, filters))
            .map(candidate => this.createCandidateView(candidate));
    }

    // Stage Management
    private initializeStage(): deliveryManagementTypes.StageDetails {
        return {
            stageName: 'Initial Review',
            stageDescription: 'Description for ' + "Initial Review",
            stageDate: new Date(),
            status: deliveryManagementTypes.CandidateStatus.SHORTLISTED,
            currentSubStage: 'Initial Review',
            progress: 0,
            pendingActions: [],
            completedMilestones: [],
            nextSteps: this.getDefaultNextSteps(),
            timeline: {
                startDate: new Date(),
                expectedEndDate: new Date(),
                events: [],
                currentDuration: 0
            },
            stakeholders: []
        };
    }

    getDefaultNextSteps(): deliveryManagementTypes.Step[] {
        throw new Error('Method not implemented.');
    }

    private createStageDetails(status: deliveryManagementTypes.CandidateStatus): deliveryManagementTypes.StageDetails {
        // Create stage specific details
        return {
            stageName: 'Stage Name', // Add appropriate value
            stageDescription: 'Stage Description', // Add appropriate value
            stageDate: new Date(), // Add appropriate value
            status,
            currentSubStage: this.getSubStageForStatus(status),
            progress: 0,
            pendingActions: this.getActionsForStage(status),
            completedMilestones: [],
            nextSteps: this.getNextStepsForStage(status),
            timeline: {
                startDate: new Date(),
                expectedEndDate: this.calculateExpectedEndDate(status),
                events: [],
                currentDuration: 0
            },
            stakeholders: this.getStakeholdersForStage(status)
        };
    }

    getStakeholdersForStage(status: deliveryManagementTypes.CandidateStatus): deliveryManagementTypes.StakeholderInfo[] {
        throw new Error('Method not implemented.');
    }

    calculateExpectedEndDate(status: deliveryManagementTypes.CandidateStatus): Date {
        throw new Error('Method not implemented.');
    }

    getNextStepsForStage(status: deliveryManagementTypes.CandidateStatus): deliveryManagementTypes.Step[] {
        throw new Error('Method not implemented.');
    }

    getActionsForStage(status: deliveryManagementTypes.CandidateStatus): deliveryManagementTypes.Action[] {
        throw new Error('Method not implemented.');
    }

    getSubStageForStatus(status: deliveryManagementTypes.CandidateStatus): string {
        throw new Error('Method not implemented.');
    }

    // Reporting
    generateReport(type: deliveryManagementTypes.ReportType, filters?: deliveryManagementTypes.FilterCriteria): deliveryManagementTypes.Report {
        const metrics = this.calculateMetrics(type, filters);
        const visualizations = this.createVisualizations(metrics);
        return {
            id: generateUniqueId(),
            type: type,
            dateRange: {
                start: new Date(),
                end: new Date()
            },
            metrics,
            visualizations,
            insights: this.generateInsights(metrics)
        };
    }

    private calculateMetrics(type: deliveryManagementTypes.ReportType, filters?: deliveryManagementTypes.FilterCriteria): deliveryManagementTypes.ReportMetric[] {
        // Calculate metrics based on report type
        return [];
    }

    private createVisualizations(metrics: deliveryManagementTypes.ReportMetric[]): deliveryManagementTypes.ChartData[] {
        // Create visualizations based on metrics
        return [];
    }

    private generateInsights(metrics: deliveryManagementTypes.ReportMetric[]): string[] {
        // Generate insights based on metrics
        return [];
    }

    // Utility Methods
    private applyFilters(candidate: deliveryManagementTypes.Candidate, filters: deliveryManagementTypes.FilterCriteria): boolean {
        if (filters.status && !filters.status.includes(candidate.status)) return false;
        // Apply other filters
        return true;
    }

    private createCandidateView(candidate: deliveryManagementTypes.Candidate): deliveryManagementTypes.CandidateView {
        return {
            id: candidate.id,
            name: candidate.name,
            currentStatus: candidate.currentStage,
            matchScore: this.calculateMatchScore(candidate),
            keySkills: candidate.skills,
            experience: candidate.experience,
            currentCtc: candidate.currentCtc,
            expectedCtc: candidate.expectedCtc,
            noticePeriod: candidate.noticePeriod,
            lastActivity: candidate.currentStage.timeline.events[0],
            pendingActions: candidate.currentStage.pendingActions
        };
    }

    private notifyStatusChange(candidateId: string, status: deliveryManagementTypes.CandidateStatus): void {
        const candidate = this.candidates.get(candidateId);
        if (!candidate) throw new Error('Candidate not found');
        this.notificationService.sendNotification(
            candidate.id,
            deliveryManagementTypes.NotificationType.STATUS_CHANGE,
            {
                subject: '',
                message: '',
                candidateId: '',
                shareId: '',
                clientId: '',
                recruiterId: ''
            }
        );

        // Add task for candidate status change
        this.taskManagementSystem.addTask(candidateId, {
            id: generateUniqueId(),
            description: `Status changed to ${status}`,
            status: deliveryManagementTypes.TaskStatus.PENDING,
            dueDate: new Date(),
            title: '',
            deadline: new Date(),
            assignedTo: [],
            priority: 'low',
            notifications: []
        });
    }

    private calculateMatchScore(candidate: deliveryManagementTypes.Candidate): number {
        // Calculate match score based on requirements
        return 0;
    }
}
  // Component: Shortlisting Phase
  export class ShortlistingManager {
    private candidates: Map<string, deliveryManagementTypes.Candidate>;
    private clients: Map<string, deliveryManagementTypes.Client>;

    constructor(candidates: Map<string, deliveryManagementTypes.Candidate>, clients: Map<string, deliveryManagementTypes.Client>) {
      this.candidates = candidates;
      this.clients = clients;
    }

    shortlistCandidate(candidateId: string): void {
      // Add candidate to shortlist
      // Notify recruiter
      // Update candidate status
    }
  
    shareWithClient(candidateId: string, clientId: string): void {
      // Share candidate profile
      // Track sharing status
      // Notify client of new candidate
    }
  }
  
  // Component: Client Review Phase
  class ClientReviewManager {
    private candidates: Map<string, deliveryManagementTypes.Candidate>;
    private clients: Map<string, deliveryManagementTypes.Client>;

    constructor(candidates: Map<string, deliveryManagementTypes.Candidate>, clients: Map<string, deliveryManagementTypes.Client>) {
      this.candidates = candidates;
      this.clients = clients;
    }

    submitClientFeedback(candidateId: string, feedback: deliveryManagementTypes.Feedback): void {
      // Store feedback
      // Notify recruiter
      // Update candidate status
    }
  
    getCandidateFeedback(candidateId: string): void {
      // Get candidate's feedback on client/role
      // Update feedback in system
      // Share with relevant stakeholders
    }
  }
  
  // Component: Interview Management
  class InterviewManager {
    private candidates: Map<string, deliveryManagementTypes.Candidate>;
    private clients: Map<string, deliveryManagementTypes.Client>;

    constructor(candidates: Map<string, deliveryManagementTypes.Candidate>, clients: Map<string, deliveryManagementTypes.Client>) {
      this.candidates = candidates;
      this.clients = clients;
    }

    async scheduleInterview(
      candidateId: string, 
      clientId: string, 
      round: number
    ): Promise<deliveryManagementTypes.Interview> {
      // Check availability
      // Schedule interview
      // Send calendar invites
      // Notify all parties
      const newInterview: deliveryManagementTypes.Interview = {
          id: 'interview-id',
          feedback: { rating: 0, comments: '' },
          scheduledTime: new Date(),
          status: deliveryManagementTypes.InterviewStatus.SCHEDULED,
          candidateId: '',
          clientId: '',
          round: 0,
          duration: 0,
          mode: deliveryManagementTypes.InterviewMode.ONLINE,
          interviewRequest: {
              interviewers: [],
              dateTimeEnd: new Date(),
              dateTimeStart: new Date(),
              mode: deliveryManagementTypes.InterviewMode.ONLINE,
              duration: 60,
              candidateId: '',
              round: 0,
              preferredSlots: []
          },
          date: new Date(), 
      };
      return newInterview;
    }
  
    recordInterviewFeedback(interviewId: string, feedback: deliveryManagementTypes.Feedback): void {
      // Store feedback
      // Update candidate status
      // Notify relevant parties
    }
  }
  
  // Component: Assessment Management
  class AssessmentManager {
    async setupTracking(id: any, arg1: { deadline: Date; reminderSchedule: deliveryManagementTypes.ReminderSchedule; }) {
        throw new Error('Method not implemented.');
    }
    private candidates: Map<string, deliveryManagementTypes.Candidate>;

    constructor(candidates: Map<string, deliveryManagementTypes.Candidate>) {
      this.candidates = candidates;
    }
    async initiateAssessment(candidateId: string, assessmentRequest: deliveryManagementTypes.AssessmentRequest): Promise<deliveryManagementTypes.Assessment> {
      // Create assessment
        const assessment: deliveryManagementTypes.Assessment = {
            id: generateUniqueId(),
            request: assessmentRequest,
            status: deliveryManagementTypes.AssessmentStatusType.PENDING,
            createdAt: new Date(),
            type: '',
            result: ''
        };
      // Send assessment link
      // Set reminders
      return assessment;
    }
  
    async trackAssessmentProgress(assessmentId: string): Promise<void> {
      // Monitor completion
      // Send reminders if needed
      // Update status
    }
  }
  
  // Component: Offer Management
  class OfferManager {
    private candidates: Map<string, deliveryManagementTypes.Candidate>;
    private clients: Map<string, deliveryManagementTypes.Client>;

    constructor(candidates: Map<string, deliveryManagementTypes.Candidate>, clients: Map<string, deliveryManagementTypes.Client>) {
      this.candidates = candidates;
      this.clients = clients;
    }

    initiateReferenceCheck(candidateId: string): void {
      // Create reference check requests
      // Track responses
      // Update status
    }
  
    collectDocuments(candidateId: string): void {
      // Request required documents
      // Track submission
      // Verify documents
    }
  
    negotiateSalary(candidateId: string, offerDetails: deliveryManagementTypes.OfferDetails): void {
      // Handle negotiation
      // Update offer details
      // Get approvals
    }
  }
  
  // Component: Onboarding Management
  class OnboardingManager {
    private candidates: Map<string, deliveryManagementTypes.Candidate>;

    constructor(candidates: Map<string, deliveryManagementTypes.Candidate>) {
      this.candidates = candidates;
    }
    trackOfferAcceptance(candidateId: string): void {
      // Track offer letter status
      // Update system
      // Notify stakeholders
    }
  
    manageNoticePeriod(candidateId: string): void {
      // Track resignation
      // Monitor acceptance
      // Update joining date
    }
  
    monitorJoiningProcess(candidateId: string): void {
      // Track pre-joining documentation
      // Send reminders
      // Update status
    }
  }
  
  // Notification System
  class NotificationService {
    async sendNotification(
      recipient: string, 
      type: deliveryManagementTypes.NotificationType, 
      content: deliveryManagementTypes.NotificationContent
    ): Promise<void> {
      // Send emails/notifications
      // Track delivery
      // Handle failures
    }
  }
  
  // Event Tracking System
  class EventTrackingSystem {
    logEvent(event: deliveryManagementTypes.RecruitmentEvent): void {
      // Log all system events
      console.log(`Event logged: ${event.type} at ${event.timestamp}`);
      
      // Update dashboards
      this.updateDashboards(event);
      
      // Generate reports
      this.generateReports(event);
    }

    private updateDashboards(event: deliveryManagementTypes.RecruitmentEvent): void {
      // Implementation for updating dashboards with the event
      console.log(`Dashboard updated with event: ${event.type}`);
    }

    private generateReports(event: deliveryManagementTypes.RecruitmentEvent): void {
      // Implementation for generating reports based on the event
      console.log(`Report generated for event: ${event.type}`);
    }
  }

function generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
}
// Task Management System
class TaskManagementSystem {
    private tasks: Map<string, deliveryManagementTypes.Task[]>;

    constructor() {
        this.tasks = new Map();
    }

    addTask(entityId: string, task: deliveryManagementTypes.Task): void {
        if (!this.tasks.has(entityId)) {
            this.tasks.set(entityId, []);
        }
        this.tasks.get(entityId)?.push(task);
    }

    getTasks(entityId: string): deliveryManagementTypes.Task[] {
        return this.tasks.get(entityId) || [];
    }

    updateTaskStatus(entityId: string, taskId: string, status: deliveryManagementTypes.TaskStatus): void {
        const entityTasks = this.tasks.get(entityId);
        if (!entityTasks) throw new Error('Entity not found');

        const task = entityTasks.find(task => task.id === taskId);
        if (!task) throw new Error('Task not found');

        task.status = status;
    }
}

// Example usage within CandidateManagementSystem


// Now let's extend the CandidateManagementSystem with CV sharing functionality

export class CVSharingManager {
    private cvShares: Map<string, deliveryManagementTypes.CVShare>;
    private candidateCVs: Map<string, deliveryManagementTypes.CV[]>;
    notificationService: NotificationService;
    assessmentManager: AssessmentManager;
    interviewManager: InterviewManager;

    candidateManagementSystem : CandidateManagementSystem
    
    constructor(
      private candidates: Map<string, deliveryManagementTypes.Candidate>,
      private clients: Map<string, deliveryManagementTypes.Client>,
      private eventTracker: EventTrackingSystem
    ) {
      this.cvShares = new Map();
      this.candidateCVs = new Map();
    this.notificationService = new NotificationService();
    this.assessmentManager = new AssessmentManager(this.candidates);
    this.interviewManager = new InterviewManager(this.candidates, this.clients);
    this.candidateManagementSystem = new CandidateManagementSystem();
    }
   

    async processClientResponse(response: deliveryManagementTypes.ClientResponse): Promise<void> {
        const share = this.cvShares.get(response.shareId);
        if (!share) throw new Error('Share not found');
    
        switch (response.decision) {
          case deliveryManagementTypes.ClientDecision.SCHEDULE_INTERVIEW:
            await this.initiateInterview(response, share);
            break;
          case deliveryManagementTypes.ClientDecision.CONDUCT_ASSESSMENT:
            await this.initiateAssessment(response);
            break;
          case deliveryManagementTypes.ClientDecision.REJECT:
            await this.processCandidateRejection(response, share);
            break;
        }
    
        // Update CV share status
        await this.updateShareStatus(share, response);
      }



      private async initiateInterview(response: deliveryManagementTypes.ClientResponse, share: deliveryManagementTypes.CVShare): Promise<void> {
        const interviewRequest = response.details as deliveryManagementTypes.InterviewRequest;
        
        // Update candidate status
        await this.candidateManagementSystem.updateCandidateStatus(
          response.candidateId, 
          deliveryManagementTypes.CandidateStatus.INTERVIEW_PROCESS
        );
    
        // Create interview in InterviewManager
        const interview = await this.interviewManager.scheduleInterview(
          response.candidateId,
          share.clientId,
          interviewRequest.round
        );
    
        // Notify relevant parties
        await this.notifyInterviewInitiated(interview, response, share);
    
        // Log event
        this.eventTracker.logEvent({
            type: deliveryManagementTypes.EventType.INTERVIEW_SCHEDULED,
            candidateId: response.candidateId,
            details: interview,
            eventType: '',
            timestamp: new Date()
        });
      }
    
      private async initiateAssessment(response: deliveryManagementTypes.ClientResponse): Promise<void> {
        const assessmentRequest = response.details as deliveryManagementTypes.AssessmentRequest;
    
        // Update candidate status
        await this.updateCandidateStatus(
          response.candidateId, 
          deliveryManagementTypes.CandidateStatus.ASSESSMENT
        );
    
        // Create assessment in AssessmentManager
        const assessment = await this.assessmentManager.initiateAssessment(
          response.candidateId,
          assessmentRequest
        );
    
        // Set up tracking and reminders
        await this.assessmentManager.setupTracking(assessment.id, {
          deadline: assessmentRequest.deadline,
          reminderSchedule: this.calculateReminderSchedule(assessmentRequest)
        });
    
        // Notify candidate and recruiter
        await this.notifyAssessmentInitiated(assessment, response);
    
        // Log event
        this.eventTracker.logEvent({
            type: deliveryManagementTypes.EventType.ASSESSMENT_INITIATED,
            candidateId: response.candidateId,
            details: assessment,
            eventType: '',
            timestamp: new Date()
        });
      }
    updateCandidateStatus(candidateId: string, ASSESSMENT: deliveryManagementTypes.CandidateStatus) {
        throw new Error('Method not implemented.');
    }
    
      private async processCandidateRejection(response: deliveryManagementTypes.ClientResponse, share: deliveryManagementTypes.CVShare): Promise<void> {
        const rejectionDetails = response.details as deliveryManagementTypes.RejectionDetails;
    
        // Update candidate status
        this.updateCandidateStatus(
              response.candidateId,
              deliveryManagementTypes.CandidateStatus.REJECTED
          );
    
        // Store rejection details
        await this.storeRejectionFeedback(response.candidateId, rejectionDetails);
    
        // Update candidate pipeline
        if (rejectionDetails.possibleFutureMatch) {
          await this.addToPotentialPool(response.candidateId, rejectionDetails);
        }
    
        // Notify recruiter
        await this.notifyRejection(response, share);
    
        // Log event
        this.eventTracker.logEvent({
            type: deliveryManagementTypes.EventType.CANDIDATE_REJECTED,
            candidateId: response.candidateId,
            details: rejectionDetails,
            eventType: '',
            timestamp: new Date()
        });
      }
    addToPotentialPool(candidateId: string, rejectionDetails: deliveryManagementTypes.RejectionDetails) {
        throw new Error('Method not implemented.');
    }
    storeRejectionFeedback(candidateId: string, rejectionDetails: deliveryManagementTypes.RejectionDetails) {
        throw new Error('Method not implemented.');
    }
    
      private async updateShareStatus(share: deliveryManagementTypes.CVShare, response: deliveryManagementTypes.ClientResponse): Promise<void> {
        share.status = 'feedback_received';
        share.feedback = {
          stakeholderId: response.stakeholderId,
          decision: response.decision,
          timestamp: new Date(),
          rating: 0, // Add appropriate value
          comments: '', // Add appropriate value
          skillAssessment: new Map<string, number>(), // Add appropriate value
          interestLevel: "medium" // Add appropriate value
        };
    
        this.cvShares.set(share.id, share);
      }
    
      private async notifyInterviewInitiated(interview: deliveryManagementTypes.Interview, response: deliveryManagementTypes.ClientResponse, share: deliveryManagementTypes.CVShare): Promise<void> {
        // Notify candidate
        await this.notificationService.sendNotification(
          response.candidateId,
          deliveryManagementTypes.NotificationType.INTERVIEW_SCHEDULED,
          {
              interview,
              subject: '',
              candidateId: '',
              shareId: '',
              clientId: '',
              recruiterId: '',
              message: ''
          }
        );
    
        // Notify recruiter
        await this.notificationService.sendNotification(
          share.recruiterId,
          deliveryManagementTypes.NotificationType.INTERVIEW_SCHEDULED,
          {
              interview, candidateId: response.candidateId,
              subject: '',
              shareId: '',
              clientId: '',
              recruiterId: '',
              message: ''
          }
        );
    
        // Notify client stakeholders
        await this.notifyStakeholders(
          share.clientId,
          'interview_scheduled',
          { interview },
          share
        );
      }
    
      private async notifyAssessmentInitiated(assessment: deliveryManagementTypes.Assessment, response: deliveryManagementTypes.ClientResponse): Promise<void> {
        // Similar notification pattern as interview
        // ... implementation
      }
    
      private async notifyRejection(response: deliveryManagementTypes.ClientResponse, share: deliveryManagementTypes.CVShare): Promise<void> {
        // Notify recruiter only - candidate notification handled separately
        await this.notificationService.sendNotification(
          share.recruiterId,
          deliveryManagementTypes.NotificationType.CANDIDATE_REJECTED,
          {
            candidateId: response.candidateId,
            clientId: share.clientId,
            subject: '',
            message: '',
            shareId: '',
            recruiterId: ''
          }
        );
      }
    
      private calculateReminderSchedule(request: deliveryManagementTypes.AssessmentRequest): deliveryManagementTypes.ReminderSchedule {
        // Calculate reminder points based on deadline and priority
        const deadlineDate = new Date(request.deadline);
        const now = new Date();
        const daysUntilDeadline = Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
        return {
          initial: now,
          reminders: this.generateReminderDates(daysUntilDeadline, request.priority),
          final: new Date(deadlineDate.getTime() - (24 * 60 * 60 * 1000)) // 1 day before
        };
      }
    generateReminderDates(daysUntilDeadline: number, priority: string): Date[] {
        throw new Error('Method not implemented.');
    }
    
    
    

    async prepareCV(candidateId: string, clientId: string, options: deliveryManagementTypes.CVCustomization): Promise<deliveryManagementTypes.CV> {
      const candidate = this.candidates.get(candidateId);
      if (!candidate) throw new Error('Candidate not found');
   
      const baseCV = await this.getLatestCV(candidateId);
      return this.customizeCV(baseCV, clientId, options);
    }
   
    async shareCV(
      candidateId: string, 
      clientId: string, 
      recruiterId: string,
      options: {
        expiryDays: number;
        anonymize: boolean;
        customization?: deliveryManagementTypes.CVCustomization;
      }
    ): Promise<deliveryManagementTypes.CVShare> {
      const defaultCustomization: deliveryManagementTypes.CVCustomization = {
        clientId: clientId,
        modifications: {
            hidePersonalInfo: false,
            emphasizedSkills: [],
            hiddenDetails: [],
            reorderedSections: []
        }
      };
      const cv = await this.prepareCV(candidateId, clientId, { ...defaultCustomization, ...options.customization });
      
      const share: deliveryManagementTypes.CVShare = {
          id: generateUniqueId(),
          cvId: cv.id,
          candidateId,
          clientId,
          recruiterId,
          sharedAt: new Date(),
          expiresAt: new Date(Date.now() + options.expiryDays * 24 * 60 * 60 * 1000),
          status: 'pending',
          viewHistory: [],
          share: {
              stakeholderId: '',
              decision: deliveryManagementTypes.ClientDecision.SCHEDULE_INTERVIEW,
              timestamp: new Date()
          }
      };
   
      this.cvShares.set(share.id, share);
      await this.notifyStakeholders(
        share.clientId,
        'new_cv_shared',
        { interview: {} as deliveryManagementTypes.Interview }, // or appropriate value
        share
      );
      
      return share;
    }
   
  async notifyStakeholders(clientId: string, p0: string, p1: { interview: deliveryManagementTypes.Interview; }, share: deliveryManagementTypes.CVShare): Promise<void> {
    const client = this.clients.get(share.clientId);
    if (!client) throw new Error('Client not found');
    const relevantStakeholders = client.stakeholders.filter(
      s => s.permissions.canViewDocuments
    );
  
    for (const stakeholder of relevantStakeholders) {
      await this.notificationService.sendNotification(
        stakeholder.id,
        deliveryManagementTypes.NotificationType.NEW_CV_SHARED,
        {
            candidateId: share.candidateId,
            shareId: share.id,
            recruiterId: share.recruiterId,
            subject: '',
            message: '',
            clientId: share.clientId
        }
      );
    }
  }
   
    recordView(shareId: string, stakeholderId: string): void {
      const share = this.cvShares.get(shareId);
      if (!share) throw new Error('Share not found');
   
      const viewRecord: deliveryManagementTypes.ViewRecord = {
        stakeholderId,
        viewedAt: new Date(),
        duration: 0 // Will be updated when viewer closes the CV
      };
   
      share.viewHistory.push(viewRecord);
      share.status = 'viewed';
    }
   
    async receiveFeedback(shareId: string, feedback: deliveryManagementTypes.ClientFeedback): Promise<void> {
      const share = this.cvShares.get(shareId);
      if (!share) throw new Error('Share not found');
   
      share.feedback = feedback;
      share.status = 'feedback_received';
   
      // Notify recruiter of feedback
      await this.notificationService.sendNotification(
        share.recruiterId,
        deliveryManagementTypes.NotificationType.CV_FEEDBACK_RECEIVED,
        {
            shareId,
            candidateId: share.candidateId,
            clientId: share.clientId,
            subject: '',
            message: '',
            recruiterId: ''
        }
      );
    }
   
    getShareAnalytics(shareId: string): deliveryManagementTypes.ShareAnalytics {
      const share = this.cvShares.get(shareId);
      if (!share) throw new Error('Share not found');
   
      return {
        totalViews: share.viewHistory.length,
        uniqueViewers: new Set(share.viewHistory.map(v => v.stakeholderId)).size,
        averageViewDuration: this.calculateAverageViewDuration(share.viewHistory),
        stakeholderEngagement: this.calculateStakeholderEngagement(share),
        timeToFirstView: this.calculateTimeToFirstView(share),
        timeToFeedback: share.feedback ? 
          this.calculateTimeToFeedback(share) : null
      };
    }
   
    private async getLatestCV(candidateId: string): Promise<deliveryManagementTypes.CV> {
      const cvs = this.candidateCVs.get(candidateId) || [];
      return cvs[cvs.length - 1];
    }
   
    private async customizeCV(cv: deliveryManagementTypes.CV, clientId: string, options: deliveryManagementTypes.CVCustomization): Promise<deliveryManagementTypes.CV> {
      // Apply customizations based on client preferences
      return {
        ...cv,
        id: generateUniqueId(),
        version: cv.version + 1,
        customizations: [...cv.customizations, options]
      };
    }
   
    // Analytics helper methods
    private calculateAverageViewDuration(viewHistory: deliveryManagementTypes.ViewRecord[]): number {
      if (viewHistory.length === 0) return 0;
      const totalDuration = viewHistory.reduce((sum, record) => sum + record.duration, 0);
      return totalDuration / viewHistory.length;
    }
   
    private calculateStakeholderEngagement(share: deliveryManagementTypes.CVShare): number {
      // Calculate engagement score based on views and feedback
      return 0; // Implementation details
    }
   
    private calculateTimeToFirstView(share: deliveryManagementTypes.CVShare): number {
      if (share.viewHistory.length === 0) return 0;
      const firstView = share.viewHistory[0];
      return firstView.viewedAt.getTime() - share.sharedAt.getTime();
    }
   
    private calculateTimeToFeedback(share: deliveryManagementTypes.CVShare): number {
      if (!share.feedback) return 0;
      return share.feedback.stakeholderId ? 
        share.sharedAt.getTime() - new Date().getTime() : 0;
    }
   }
   
   