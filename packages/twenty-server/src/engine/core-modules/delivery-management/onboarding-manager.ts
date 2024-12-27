import * as deliveryManagementTypes from './types/delivery-management.types';
import { NotificationService } from './notification-service';

export class OnboardingManager {
    private candidates: Map<string, deliveryManagementTypes.Candidate>;
    private notificationService: NotificationService;

    constructor(candidates: Map<string, deliveryManagementTypes.Candidate>) {
        this.candidates = candidates;
        this.notificationService = new NotificationService();
    }

    async setJoiningDate(candidateId: string, joiningDate: Date): Promise<void> {
        const candidate = this.candidates.get(candidateId);
        if (!candidate) throw new Error('Candidate not found');

        candidate.joiningDate = joiningDate;

        await this.notificationService.sendNotification(
            candidateId,
            deliveryManagementTypes.NotificationType.JOINING_DATE_SET,
            {
                subject: 'Joining Date Set',
                message: `Your joining date has been set to ${joiningDate.toDateString()}. Please be prepared.`,
                candidateId: candidateId,
                shareId: '',
                clientId: '',
                recruiterId: ''
            }
        );

        await this.notificationService.sendNotification(
            candidate.clientId,
            deliveryManagementTypes.NotificationType.JOINING_DATE_SET,
            {
                subject: 'Candidate Joining Date Set',
                message: `The joining date for candidate ${candidate.name} has been set to ${joiningDate.toDateString()}.`,
                candidateId: candidateId,
                shareId: '',
                clientId: candidate.clientId,
                recruiterId: ''
            }
        );
    }

    async setupJoiningFollowUps(candidateId: string): Promise<void> {
        const candidate = this.candidates.get(candidateId);
        if (!candidate) throw new Error('Candidate not found');

        const followUpDate = new Date(candidate.joiningDate);
        followUpDate.setDate(followUpDate.getDate() + 1); // Follow up the day after joining

        await this.notificationService.sendNotification(
            candidateId,
            deliveryManagementTypes.NotificationType.FOLLOW_UP,
            {
                subject: 'Joining Follow-Up',
                message: `We will follow up with you on ${followUpDate.toDateString()} to confirm your joining.`,
                candidateId: candidateId,
                shareId: '',
                clientId: '',
                recruiterId: ''
            }
        );

        await this.notificationService.sendNotification(
            candidate.clientId,
            deliveryManagementTypes.NotificationType.FOLLOW_UP,
            {
                subject: 'Candidate Joining Follow-Up',
                message: `We will follow up with you on ${followUpDate.toDateString()} to confirm the joining of candidate ${candidate.name}.`,
                candidateId: candidateId,
                shareId: '',
                clientId: candidate.clientId,
                recruiterId: ''
            }
        );
    }

    async followUpOnJoiningDate(candidateId: string): Promise<void> {
        const candidate = this.candidates.get(candidateId);
        if (!candidate) throw new Error('Candidate not found');

        await this.notificationService.sendNotification(
            candidateId,
            deliveryManagementTypes.NotificationType.FOLLOW_UP,
            {
                subject: 'Joining Confirmation',
                message: 'Please confirm if you have joined the firm today.',
                candidateId: candidateId,
                shareId: '',
                clientId: '',
                recruiterId: ''
            }
        );

        await this.notificationService.sendNotification(
            candidate.clientId,
            deliveryManagementTypes.NotificationType.FOLLOW_UP,
            {
                subject: 'Candidate Joining Confirmation',
                message: `Please confirm if candidate ${candidate.name} has joined the firm today.`,
                candidateId: candidateId,
                shareId: '',
                clientId: candidate.clientId,
                recruiterId: ''
            }
        );
    }

    async handleJoiningConfirmation(candidateId: string, clientId: string): Promise<void> {
        const candidate = this.candidates.get(candidateId);
        if (!candidate) throw new Error('Candidate not found');

        // Congratulate the candidate
        await this.notificationService.sendNotification(
            candidateId,
            deliveryManagementTypes.NotificationType.CONGRATULATIONS,
            {
                subject: 'Congratulations on Joining!',
                message: 'Congratulations on joining the firm! We wish you all the best in your new role.',
                candidateId: candidateId,
                shareId: '',
                clientId: '',
                recruiterId: ''
            }
        );

        // Congratulate the client
        await this.notificationService.sendNotification(
            clientId,
            deliveryManagementTypes.NotificationType.CONGRATULATIONS,
            {
                subject: 'Congratulations on Your New Hire!',
                message: `Congratulations on hiring ${candidate.name}! We wish you all the best with your new team member.`,
                candidateId: candidateId,
                shareId: '',
                clientId: clientId,
                recruiterId: ''
            }
        );

        // Raise an invoice to the client
        await this.raiseInvoiceToClient(clientId, candidateId);
    }

    private async raiseInvoiceToClient(clientId: string, candidateId: string): Promise<void> {
        // Placeholder implementation to raise an invoice
        console.log(`Invoice raised to client ${clientId} for candidate ${candidateId}.`);
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
