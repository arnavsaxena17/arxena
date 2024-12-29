import { Injectable, Logger } from '@nestjs/common';
import * as deliveryManagementTypes from '../types/delivery-management.types';
import { PhaseTransitionManager } from '../managers/phase-change-transition-manager';

@Injectable()
export class EventProcessorJob {
  private readonly logger = new Logger(EventProcessorJob.name);

  constructor(
    private readonly phaseTransitionManager: PhaseTransitionManager,
  ) {}

  public static readonly jobName = 'EVENT_PROCESSOR';

  async handle(event: deliveryManagementTypes.RecruitmentEvent): Promise<void> {
    try {
      switch (event.eventType as deliveryManagementTypes.EventType) {
        case deliveryManagementTypes.EventType.STATUS_CHANGE:
          await this.handleStatusChange(event);
          break;
        case deliveryManagementTypes.EventType.INTERVIEW_COMPLETED:
          await this.handleInterviewCompletion(event);
          break;
        case deliveryManagementTypes.EventType.ASSESSMENT_COMPLETED:
          await this.handleAssessmentCompletion(event);
          break;
        case deliveryManagementTypes.EventType.OFFER_ACCEPTED:
          await this.handleOfferAcceptance(event);
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing event ${event.id}`, error.stack);
      throw error; // Allow queue to handle retry
    }
  }
    handleOfferAcceptance(event: deliveryManagementTypes.RecruitmentEvent) {
        throw new Error('Method not implemented.');
    }
    handleAssessmentCompletion(event: deliveryManagementTypes.RecruitmentEvent) {
        throw new Error('Method not implemented.');
    }
    handleInterviewCompletion(event: deliveryManagementTypes.RecruitmentEvent) {
        throw new Error('Method not implemented.');
    }

  private async handleStatusChange(event: deliveryManagementTypes.RecruitmentEvent): Promise<void> {
    const details = event.details as unknown as deliveryManagementTypes.StateChangeEvent;
    const result = await this.phaseTransitionManager.validatePhaseTransition(
      details.previousState as unknown as deliveryManagementTypes.RecruitmentPhases,
      details.newState as unknown as deliveryManagementTypes.RecruitmentPhases,
      { id: event.candidateId },
      details.actor.role
    );

    if (result.isErr()) {
      throw new Error(`Invalid state transition: ${result.getError().message}`);
    }
  }

  // ...existing handler methods from cron...
}
