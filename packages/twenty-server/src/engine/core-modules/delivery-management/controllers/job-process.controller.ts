import * as deliveryManagementTypes from '../types/delivery-management.types';
import { DeliveryManagementSystem } from '../services/delivery-management-system';
import { Router, Request, Response } from 'express';
import { Body, Controller, Post } from '@nestjs/common';
import { EventProcessingSystem } from '../services/event-processing-system';
import { DateTime } from 'luxon';



@Controller('job-process')
export class JobProcessController {
    private deliveryManagementSystem: DeliveryManagementSystem;
    private eventProcessingSystem: EventProcessingSystem;

    constructor() {
        this.deliveryManagementSystem = new DeliveryManagementSystem();
        this.eventProcessingSystem = new EventProcessingSystem();
    }

    @Post('create')
    async createJobProcessEndpoint(@Body() data: { 
      jobId: string;
      clientId: string;
      stages: Partial<deliveryManagementTypes.JobStage>[];
    }): Promise<deliveryManagementTypes.Result<deliveryManagementTypes.JobProcess, Error>> {
      try {
        // Validate and transform stages
        const validatedStages = data.stages.map((stage, index) => {
          const jobStage: deliveryManagementTypes.JobStage = {
            type: stage.type || deliveryManagementTypes.JobStageType.SOURCING,
            requirement: {
              required: stage.requirement?.required ?? true,
              order: stage.requirement?.order ?? index,
              dependencies: stage.requirement?.dependencies || []
            },
            config: {
              screeningTypes: stage.config?.screeningTypes || [],
              interviewRounds: stage.config?.interviewRounds?.map(round => ({
                round: round.round,
                mode: round.mode || deliveryManagementTypes.InterviewMode.ONLINE,
                duration: round.duration || 60,
                requiredInterviewers: round.requiredInterviewers || 1
              })) || [],
              assessmentTypes: stage.config?.assessmentTypes || [],
              referenceRequirements: stage.config?.referenceRequirements || {
                minimumReferences: 0,
                preferredTypes: []
              }
            },
            status: 'NOT_STARTED'
          };

          return jobStage;
        });

        const jobProcess: deliveryManagementTypes.JobProcess = {
          id: data.jobId || generateUniqueId(),
          clientId: data.clientId,
          stages: validatedStages,
          currentStage: validatedStages[0].type,
          settings: {
            allowParallelStages: false,
            autoProgressEnabled: true,
            requireApprovalBetweenStages: true
          },
          metadata: {
            createdAt: DateTime.now(),
            updatedAt: DateTime.now(),
            createdBy: 'system'
          }
        };

        // Validate the complete job process
        if (!this.validateJobProcess(jobProcess)) {
          return deliveryManagementTypes.Result.failure(
            new Error('Invalid job process configuration')
          );
        }

        // Store in delivery management system
        this.deliveryManagementSystem.jobProcesses.set(jobProcess.id, jobProcess);

        // Log event
        this.eventProcessingSystem.logEvent({
          id: generateUniqueId(),
          eventType: deliveryManagementTypes.EventType.STATUS_CHANGE,
          timestamp: DateTime.now(),
          details: `Job process created: ${jobProcess.id}`,
          candidateId: '',
          data: jobProcess,
          recruitmentState: deliveryManagementTypes.RecruitmentState.NEW
        });

        return deliveryManagementTypes.Result.success(jobProcess);

      } catch (error) {
        console.error('Error creating job process:', error);
        return deliveryManagementTypes.Result.failure(error as Error);
      }
    }

    @Post('modify')
    async modifyJobProcessEndpoint(@Body() data: {
        jobId: string;
        modifications: {
            type: 'ADD' | 'REMOVE' | 'UPDATE';
            stageIndex?: number;
            stage?: Partial<deliveryManagementTypes.JobStage>;
        }[];
    }): Promise<deliveryManagementTypes.Result<deliveryManagementTypes.JobProcess, Error>> {
        try {
            const jobProcess = this.deliveryManagementSystem.getJobProcess(data.jobId);
            if (!jobProcess) {
                return deliveryManagementTypes.Result.failure(
                    new Error('Job process not found')
                );
            }

            const modifiedStages = [...jobProcess.stages];

            // Apply modifications in order
            for (const modification of data.modifications) {
                switch (modification.type) {
                    case 'ADD':
                        if (modification.stage) {
                            const newStage = this.validateAndTransformStage(
                                modification.stage,
                                modifiedStages.length
                            );
                            if (modification.stageIndex !== undefined) {
                                modifiedStages.splice(modification.stageIndex, 0, newStage);
                            } else {
                                modifiedStages.push(newStage);
                            }
                        }
                        break;

                    case 'REMOVE':
                        if (modification.stageIndex !== undefined) {
                            modifiedStages.splice(modification.stageIndex, 1);
                        }
                        break;

                    case 'UPDATE':
                        if (modification.stageIndex !== undefined && modification.stage) {
                            const updatedStage = {
                                ...modifiedStages[modification.stageIndex],
                                ...this.validateAndTransformStage(
                                    modification.stage,
                                    modification.stageIndex
                                )
                            };
                            modifiedStages[modification.stageIndex] = updatedStage;
                        }
                        break;
                }
            }

            // Reorder stages and update dependencies
            const reorderedStages = modifiedStages.map((stage, index) => ({
                ...stage,
                requirement: {
                    ...stage.requirement,
                    order: index
                }
            }));

            const updatedJobProcess: deliveryManagementTypes.JobProcess = {
                ...jobProcess,
                stages: reorderedStages,
                metadata: {
                    ...jobProcess.metadata,
                    updatedAt: DateTime.now()
                }
            };

            // Validate the modified job process
            if (!this.validateJobProcess(updatedJobProcess)) {
                return deliveryManagementTypes.Result.failure(
                    new Error('Invalid job process configuration after modifications')
                );
            }

            // Update in delivery management system
            this.deliveryManagementSystem.jobProcesses.set(data.jobId, updatedJobProcess);

            // Log modification event
            this.eventProcessingSystem.logEvent({
                id: this.generateUniqueId(),
                eventType: deliveryManagementTypes.EventType.STATUS_CHANGE,
                timestamp: DateTime.now(),
                details: `Job process modified: ${data.jobId}`,
                candidateId: '',
                data: updatedJobProcess,
                recruitmentState: deliveryManagementTypes.RecruitmentState.NEW
            });

            return deliveryManagementTypes.Result.success(updatedJobProcess);

        } catch (error) {
            console.error('Error modifying job process:', error);
            return deliveryManagementTypes.Result.failure(error as Error);
        }
    }

    private validateAndTransformStage(
        stage: Partial<deliveryManagementTypes.JobStage>,
        defaultOrder: number
    ): deliveryManagementTypes.JobStage {
        return {
            type: stage.type || deliveryManagementTypes.JobStageType.SOURCING,
            requirement: {
                required: stage.requirement?.required ?? true,
                order: stage.requirement?.order ?? defaultOrder,
                dependencies: stage.requirement?.dependencies || []
            },
            config: {
                screeningTypes: stage.config?.screeningTypes || [],
                interviewRounds: stage.config?.interviewRounds?.map(round => ({
                    round: round.round,
                    mode: round.mode || deliveryManagementTypes.InterviewMode.ONLINE,
                    duration: round.duration || 60,
                    requiredInterviewers: round.requiredInterviewers || 1
                })) || [],
                assessmentTypes: stage.config?.assessmentTypes || [],
                referenceRequirements: stage.config?.referenceRequirements || {
                    minimumReferences: 0,
                    preferredTypes: []
                }
            },
            status: 'NOT_STARTED'
        };
    }

    private validateJobProcess(jobProcess: deliveryManagementTypes.JobProcess): boolean {
      // Basic validation
      if (!jobProcess.clientId || jobProcess.stages.length === 0) {
        return false;
      }

      // Validate stage order and dependencies
      for (let i = 0; i < jobProcess.stages.length; i++) {
        const stage = jobProcess.stages[i];
        
        // Check if dependencies are valid
        if (stage.requirement.dependencies) {
          const validDependencies = stage.requirement.dependencies.every(dep => 
            jobProcess.stages.some(s => s.type === dep && 
              s.requirement.order < stage.requirement.order)
          );
          if (!validDependencies) return false;
        }

        // Validate stage specific configurations
        if (stage.type === deliveryManagementTypes.JobStageType.INTERVIEW && 
            (!stage.config.interviewRounds || stage.config.interviewRounds.length === 0)) {
          return false;
        }
      }

      return true;
    }

    private generateUniqueId(): string {
      return Math.random().toString(36).substr(2, 9);
    }

    @Post('fetch')
    async fetchJobProcessEndpoint(@Body() body: { jobId: string }, res: Response): Promise<void> {
        const { jobId } = body;
        try {
            const jobProcess = await this.deliveryManagementSystem.getJobProcess(jobId);
            if (!jobProcess) {
                res.status(404).send({ message: 'Job process not found' });
                return;
            }
            res.status(200).send(jobProcess);
        } catch (error) {
            console.log("Error fetching job process", error);
            res.status(500).send({ message: error.message });
        }
    }

    @Post('add-candidates')
    async addCandidatesToJobProcessEndpoint(@Body() body: { jobId: string, candidateIds: string[] }, res: Response): Promise<void> {
        try {
            for (const candidateId of body.candidateIds) {
                const candidate = await this.deliveryManagementSystem.getCandidate(candidateId);
                if (candidate) {
                    await this.deliveryManagementSystem.addCandidate(candidate);
                }
            }
            res.status(201).send({ message: 'Candidates added to job process successfully' });
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    }

    async createJobProcess(jobId: string, stages: deliveryManagementTypes.JobStage[]): Promise<void> {
        this.deliveryManagementSystem.createJobProcess(jobId, stages);
    }

    private async getJobProcessStatusEndpoint(req: Request, res: Response): Promise<void> {
        const { jobId } = req.params;
        try {
            const jobProcess = this.deliveryManagementSystem.getJobProcess(jobId);
            if (!jobProcess) {
                res.status(404).send({ message: 'Job process not found' });
                return;
            }
            res.status(200).send(jobProcess);
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    }

    private async collectDocumentsEndpoint(req: Request, res: Response): Promise<void> {
        const { candidateId, documents } = req.body;
        try {
            await this.deliveryManagementSystem.collectDocuments(candidateId, documents);
            res.status(200).send({ message: 'Documents collected successfully' });
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    }
}

// Define the type for createJobProcessPayload
type CreateJobProcessPayload = {
    jobId: string;
    stages: deliveryManagementTypes.JobStage[];
};

// Sample JSON values to call the controllers

// Create Job Process
const createJobProcessPayload = {
  jobId: "job123",
  clientId: "client123",
  stages: [
    {
      type: deliveryManagementTypes.JobStageType.SOURCING,
      requirement: {
        required: true,
        order: 0,
        dependencies: []
      },
      config: {
        screeningTypes: [deliveryManagementTypes.ScreeningType.CV],
        interviewRounds: [],
        assessmentTypes: [],
        referenceRequirements: {
          minimumReferences: 0,
          preferredTypes: []
        }
      },
      status: 'NOT_STARTED' as const
    }
    // ...additional stages...
  ]
};

// Collect Documents
const collectDocumentsPayload = {
    candidateId: "candidate001",
    documents: [
        deliveryManagementTypes.DocumentType.SALARY_SLIP,
        deliveryManagementTypes.DocumentType.WORK_EXPERIENCE_CERTIFICATES,
        deliveryManagementTypes.DocumentType.REFERENCE_LETTERS
    ]
};

// Add sample payload for modify endpoint
const modifyJobProcessPayload = {
    jobId: "job123",
    modifications: [
        {
            type: 'ADD' as const,
            stageIndex: 1,
            stage: {
                type: deliveryManagementTypes.JobStageType.ASSESSMENT,
                requirement: {
                    required: true,
                    dependencies: [deliveryManagementTypes.JobStageType.SOURCING]
                },
                config: {
                    assessmentTypes: ['TECHNICAL', 'BEHAVIORAL']
                }
            }
        },
        {
            type: 'UPDATE' as const,
            stageIndex: 0,
            stage: {
                config: {
                    screeningTypes: [
                        deliveryManagementTypes.ScreeningType.CV,
                        deliveryManagementTypes.ScreeningType.VIDEO
                    ]
                }
            }
        },
        {
            type: 'REMOVE' as const,
            stageIndex: 2
        }
    ]
};
function generateUniqueId(): string {
    throw new Error('Function not implemented.');
}

