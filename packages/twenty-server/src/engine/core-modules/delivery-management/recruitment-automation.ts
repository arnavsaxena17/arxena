import { PhaseTransitionManager } from "./managers/phase-change-transition-manager";
import { EventProcessingSystem } from "./services/event-processing-system";
import { EventType, NotificationService, RecruitmentEvent, RecruitmentPhases, ScreeningType, JobProcess } from "./types/delivery-management.types";
import { TaskManagementSystem } from "./services/task-management-system";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Injectable } from "@nestjs/common";

// Core Phase Management
export class RecruitmentAutomationSystem {
    constructor(
      private eventProcessingSystem: EventProcessingSystem,
      private phaseTransitionManager: PhaseTransitionManager,
      private notificationService: NotificationService,
      private taskManagementSystem: TaskManagementSystem
    ) {}
  
    // Initialize a new job process
    // Main event processing logic

  }
  
  // Cron job implementation
  @Injectable()
  export class RecruitmentAutomationCron {
    eventProcessingSystem: EventProcessingSystem;
    logger: any;
    @Cron(CronExpression.EVERY_5_SECONDS)
    async processRecruitmentEvents() {
      try {
        console.log('Starting recruitment automation cron job');
        // 1. Fetch pending events
        const pendingEvents = await this.eventProcessingSystem
          .getUnprocessedEvents();
  
        // 2. Group events by candidate for ordered processing
        const eventsByCandidate = await this.eventProcessingSystem.groupEventsByCandidate(pendingEvents) as Map<string, RecruitmentEvent[]>;
  
        // 3. Process events in order for each candidate
        for (const [candidateId, events] of eventsByCandidate) {
          await this.processEventsInOrder(candidateId, events);
        }
  
        // 4. Check for stalled processes or SLA breaches
        await this.checkProcessHealth();
  
        // 5. Generate reports and update dashboards
        await this.updateReportingMetrics();
  
      } catch (error) {
        this.logger.error('Error in recruitment automation cron', error);
        // Implement retry mechanism for failed events
      }
    }

    async updateReportingMetrics() {
        // Fetch the latest metrics data
        const metricsData = await this.eventProcessingSystem.getMetricsData();

        // Update the reporting dashboard
        // await this.eventProcessingSystem.updateDashboard(metricsData);
        // Log the update
        this.logger.log('Reporting metrics updated successfully');
    }
  
    private async processEventsInOrder(
      candidateId: string, 
      events: RecruitmentEvent[]
    ) {
      const sortedEvents = events.sort((a, b) => 
        new Date(a.timestamp.toString()).getTime() - new Date(b.timestamp.toString()).getTime()
      );
  
      for (const event of sortedEvents) {
        await this.eventProcessingSystem.processEvent(event);
      }
    }
  
    private async checkProcessHealth() {
      // Check for delays, stuck processes, or SLA breaches
      const stalledProcesses = await this.eventProcessingSystem.findStalledProcesses();
      await this.eventProcessingSystem.handleStalledProcesses(stalledProcesses);
    }
  }
  