import { Test, type TestingModule } from '@nestjs/testing';

import { getQueueToken } from 'src/engine/core-modules/message-queue/utils/get-queue-token.util';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { OutreachPeopleCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { OutreachProjectOutreachControlService } from 'src/engine/core-modules/outreach-command/services/outreach-project-outreach-control.service';
import { OutreachWorkflowRunFlowSyncService } from 'src/engine/core-modules/outreach-command/services/outreach-workflow-run-flow-sync.service';
import { OutreachWorkflowRunRepairService } from 'src/engine/core-modules/outreach-command/services/outreach-workflow-run-repair.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

const WORKSPACE_ID = '3ad8a5aa-614e-4c67-8b13-00970cd0a1fe';
const PROJECT_ID = 'dbdbdb6f-0b74-45fb-a63d-7a9b7633f2ea';
// A People-tab search hit that the CRM has never seen.
const PERSON_HASH_ID = '009c5a74f99fd6941b04f57143749769866b8711';
const LINKEDIN_URL = 'https://in.linkedin.com/in/sushant-dash-502a4015';

const buildPersonRow = (overrides: Record<string, unknown> = {}) => ({
  id: PERSON_HASH_ID,
  name: 'Sushant Dash',
  title: 'Founder',
  companyId: '',
  companyName: 'Acme',
  linkedinUrl: LINKEDIN_URL,
  warmPath: '—',
  stage: 'QUEUED',
  email: '',
  ...overrides,
});

describe('OutreachProjectOutreachControlService outreach selection', () => {
  let service: OutreachProjectOutreachControlService;
  let candidateFind: jest.Mock;
  let candidateUpdate: jest.Mock;
  let personFind: jest.Mock;
  let personUpdate: jest.Mock;
  let workflowRunFind: jest.Mock;
  let peopleCacheGet: jest.Mock;
  let queueRawDataForProcessing: jest.Mock;
  let peopleIdLookups: unknown[];

  const buildModule = async () => {
    const repositoryByName = new Map<string, unknown>([
      [
        'candidate',
        { find: candidateFind, update: candidateUpdate },
      ],
      ['person', { find: personFind, update: personUpdate }],
      ['workflowRun', { find: workflowRunFind }],
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachProjectOutreachControlService,
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: {
            executeInWorkspaceContext: jest.fn(
              (callback: () => Promise<unknown>) => callback(),
            ),
            getRepository: jest.fn(
              (_workspaceId: string, objectName: string) => {
                const repository = repositoryByName.get(objectName);

                if (!repository) {
                  throw new Error(`Unexpected repository: ${objectName}`);
                }

                return repository;
              },
            ),
          },
        },
        { provide: WorkflowRunWorkspaceService, useValue: {} },
        { provide: OutreachWorkflowRunFlowSyncService, useValue: {} },
        { provide: OutreachWorkflowRunRepairService, useValue: {} },
        { provide: OutreachPeopleCacheService, useValue: { get: peopleCacheGet } },
        {
          provide: ProcessCandidatesService,
          useValue: { queueRawDataForProcessing, isDataSourceSupported: () => true },
        },
        { provide: getQueueToken(MessageQueue.delayedJobsQueue), useValue: {} },
        { provide: getQueueToken(MessageQueue.workflowQueue), useValue: {} },
      ],
    }).compile();

    return module.get(OutreachProjectOutreachControlService);
  };

  beforeEach(async () => {
    peopleIdLookups = [];
    candidateUpdate = jest.fn().mockResolvedValue(undefined);
    personUpdate = jest.fn().mockResolvedValue(undefined);
    workflowRunFind = jest.fn().mockResolvedValue([]);
    queueRawDataForProcessing = jest.fn().mockResolvedValue(undefined);
    peopleCacheGet = jest.fn().mockResolvedValue({
      projectId: PROJECT_ID,
      cachedAt: Date.now(),
      people: [buildPersonRow()],
    });

    candidateFind = jest.fn().mockResolvedValue([]);
    personFind = jest.fn().mockResolvedValue([]);

    service = await buildModule();
  });

  // The candidate lookups the service makes: the project index (where.projectId)
  // and the explicit id/personId lookups. A hash id must never reach peopleId.
  const installCandidateLookups = (projectCandidates: unknown[]) => {
    candidateFind.mockImplementation(
      async (options: { where: Record<string, { value?: string[] }> }) => {
        const where = options?.where ?? {};

        if (where.projectId) {
          return projectCandidates;
        }

        if (where.peopleId) {
          peopleIdLookups.push(where.peopleId.value);

          return [];
        }

        if (where.id) {
          const ids = where.id.value ?? [];

          return projectCandidates.filter((candidate) =>
            ids.includes((candidate as { id: string }).id),
          );
        }

        return [];
      },
    );
  };

  it('should start an enrolled person matched by LinkedIn slug instead of failing on the hash id', async () => {
    installCandidateLookups([{ id: 'candidate-1', peopleId: 'person-1', projectId: PROJECT_ID }]);
    personFind.mockResolvedValue([
      {
        id: 'person-1',
        nameFirstName: 'Sushant',
        nameLastName: 'Dash',
        jobCompanyName: 'Acme',
        emails: { primaryEmail: '' },
        linkedinLink: { primaryLinkUrl: LINKEDIN_URL },
        doNotContact: false,
      },
    ]);

    const result = await service.startCandidates({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      candidateIds: [],
      personIds: [PERSON_HASH_ID],
      apiToken: 'token',
    });

    expect(result.startedCandidates).toBe(1);
    expect(result.enrollingPersonIds).toEqual([]);
    expect(queueRawDataForProcessing).not.toHaveBeenCalled();
    expect(candidateUpdate).toHaveBeenCalledWith(
      'candidate-1',
      expect.objectContaining({ outreachSequenceStage: 'QUEUED' }),
    );
    // The regression: a 40-hex row id must never be sent to the uuid column.
    expect(peopleIdLookups).toEqual([]);
  });

  it('should enroll a selected person the project has never seen', async () => {
    installCandidateLookups([]);
    personFind.mockResolvedValue([]);

    const result = await service.startCandidates({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      candidateIds: [],
      personIds: [PERSON_HASH_ID],
      apiToken: 'token',
      // Do not wait for the worker in a unit test.
      enrollmentPollTimeoutMs: 0,
    });

    expect(queueRawDataForProcessing).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: 'Sushant Dash',
          companyName: 'Acme',
          linkedinUrl: LINKEDIN_URL,
        }),
      ],
      'linkedin_search',
      PROJECT_ID,
      'Outreach',
      '',
      expect.any(String),
      '',
      'token',
      undefined,
      { workspaceId: WORKSPACE_ID },
    );
    expect(result.startedCandidates).toBe(0);
    expect(result.enrollingPersonIds).toEqual([PERSON_HASH_ID]);
    expect(peopleIdLookups).toEqual([]);
  });

  it('should not enroll a person already marked do not contact', async () => {
    installCandidateLookups([]);
    personFind.mockResolvedValue([
      {
        id: 'person-9',
        nameFirstName: 'Sushant',
        nameLastName: 'Dash',
        jobCompanyName: 'Acme',
        emails: { primaryEmail: '' },
        linkedinLink: { primaryLinkUrl: LINKEDIN_URL },
        doNotContact: true,
      },
    ]);

    const result = await service.startCandidates({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      candidateIds: [],
      personIds: [PERSON_HASH_ID],
      apiToken: 'token',
      enrollmentPollTimeoutMs: 0,
    });

    expect(queueRawDataForProcessing).not.toHaveBeenCalled();
    expect(result.skippedDoNotContact).toBe(1);
    expect(result.startedCandidates).toBe(0);
  });

  it('should resolve a hash id to its candidate when stopping outreach', async () => {
    installCandidateLookups([{ id: 'candidate-1', peopleId: 'person-1', projectId: PROJECT_ID }]);
    personFind.mockResolvedValue([
      {
        id: 'person-1',
        nameFirstName: 'Sushant',
        nameLastName: 'Dash',
        jobCompanyName: 'Acme',
        emails: { primaryEmail: '' },
        linkedinLink: { primaryLinkUrl: LINKEDIN_URL },
        doNotContact: false,
      },
    ]);

    const result = await service.stopCandidates({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      candidateIds: [],
      personIds: [PERSON_HASH_ID],
    });

    expect(result.stoppedCandidates).toBe(1);
    expect(candidateUpdate).toHaveBeenCalledWith(
      'candidate-1',
      expect.objectContaining({ outreachSequenceStage: 'STOPPED' }),
    );
    expect(personUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.anything() }),
      { doNotContact: true },
    );
    expect(peopleIdLookups).toEqual([]);
  });
});
