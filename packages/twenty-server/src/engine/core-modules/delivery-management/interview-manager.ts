import * as deliveryManagementTypes from './types/delivery-management.types';
import { NotificationService } from './notification-service';

export class InterviewManager {
    private candidates: Map<string, deliveryManagementTypes.Candidate>;
    private clients: Map<string, deliveryManagementTypes.Client>;
    private notificationService: NotificationService;

    constructor(candidates: Map<string, deliveryManagementTypes.Candidate>, clients: Map<string, deliveryManagementTypes.Client>) {
        this.candidates = candidates;
        this.clients = clients;
        this.notificationService = new NotificationService();
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

    async gatherClientAvailability(clientId: string): Promise<deliveryManagementTypes.Availability[]> {
        const client = this.clients.get(clientId);
        if (!client) throw new Error('Client not found');

        // Gather availability from client
        // This is a placeholder implementation
        return [
            {
                date: new Date(),
                startTime: '09:00',
                endTime: '17:00'
            }
        ];
    }

    async scheduleNextRoundInterviews(clientId: string, candidateIds: string[]): Promise<void> {
        const availability = await this.gatherClientAvailability(clientId);

        for (const candidateId of candidateIds) {
            const candidate = this.candidates.get(candidateId);
            if (!candidate) throw new Error('Candidate not found');

            if (this.isCandidateAvailable(candidate, availability)) {
                const interview = await this.scheduleInterview(candidateId, clientId, 2); // Assuming round 2
                await this.notifyCandidateOfInterview(candidateId, interview);
            } else {
                await this.handleCandidateUnavailability(candidateId);
            }
        }
    }

    private isCandidateAvailable(candidate: deliveryManagementTypes.Candidate, availability: deliveryManagementTypes.Availability[]): boolean {
        // Check candidate availability against client availability
        // This is a placeholder implementation
        return true;
    }

    private async handleCandidateUnavailability(candidateId: string): Promise<void> {
        const candidate = this.candidates.get(candidateId);
        if (!candidate) throw new Error('Candidate not found');

        // Update candidate status to unavailable
        candidate.status = deliveryManagementTypes.CandidateStatus.UNAVAILABLE;

        // Notify candidate about unavailability
        await this.notificationService.sendNotification(
            candidateId,
            deliveryManagementTypes.NotificationType.CANDIDATE_UNAVAILABLE,
            {
                subject: 'Interview Unavailability',
                message: 'You are currently unavailable for the next round of interviews. We will get back to you soon.',
                candidateId: candidateId,
                shareId: '',
                clientId: '',
                recruiterId: ''
            }
        );

        // Log event
        this.logCandidateUnavailabilityEvent(candidateId);
    }

    private logCandidateUnavailabilityEvent(candidateId: string): void {
        console.log(`Candidate ${candidateId} marked as unavailable for interviews.`);
    }

    private async notifyCandidateOfInterview(candidateId: string, interview: deliveryManagementTypes.Interview): Promise<void> {
        await this.notificationService.sendNotification(
            candidateId,
            deliveryManagementTypes.NotificationType.INTERVIEW_SCHEDULED,
            {
                interview,
                subject: 'Next Round Interview Scheduled',
                candidateId: candidateId,
                shareId: '',
                clientId: interview.clientId,
                recruiterId: '',
                message: `Your next round of interview has been scheduled on ${interview.scheduledTime}`
            }
        );
    }

    recordInterviewFeedback(interviewId: string, feedback: deliveryManagementTypes.Feedback): void {
        // Store feedback
        // Update candidate status
        // Notify relevant parties
    }
}
