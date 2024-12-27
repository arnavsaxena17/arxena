import * as deliveryManagementTypes from './types/delivery-management.types';
import { CVSharingManager } from './cv-sharing-manager';
import { ShortlistingManager } from './shortlisting-manager';

export class ProcessManagement {
    private cvSharingManager: CVSharingManager;
    private shortlistingManager: ShortlistingManager;
    private candidates: Map<string, deliveryManagementTypes.Candidate>;
    private clients: Map<string, deliveryManagementTypes.Client>;

    constructor(
        cvSharingManager: CVSharingManager,
        shortlistingManager: ShortlistingManager,
        candidates: Map<string, deliveryManagementTypes.Candidate>,
        clients: Map<string, deliveryManagementTypes.Client>
    ) {
        this.cvSharingManager = cvSharingManager;
        this.shortlistingManager = shortlistingManager;
        this.candidates = candidates;
        this.clients = clients;
    }

    async createShortlistedPool(clientId: string): Promise<void> {
        const shortlistedCandidates = Array.from(this.candidates.values())
            .filter(candidate => candidate.status === deliveryManagementTypes.CandidateStatus.SHORTLISTED)
            .slice(0, 10);

        for (const candidate of shortlistedCandidates) {
            this.shortlistingManager.shortlistCandidate(candidate.id);
            await this.cvSharingManager.shareCV(candidate.id, clientId, 'recruiter-id', {
                expiryDays: 30,
                anonymize: false
            });
        }
    }
}
