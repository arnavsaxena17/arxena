import { Test, type TestingModule } from '@nestjs/testing';

import { graphQltoUpdateOneCandidate, graphqlQueryToRemoveMessages } from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { OutreachInboundReplyWindowService } from 'src/engine/core-modules/outreach-command/jobs/outreach-inbound-reply-window.job';
import { OutreachCandidateJourneyService } from 'src/engine/core-modules/outreach-command/services/outreach-candidate-journey.service';
import { OutreachCommandMaterializeService } from 'src/engine/core-modules/outreach-command/services/outreach-command-materialize.service';
import { OutreachMockLifecycleService } from 'src/engine/core-modules/outreach-command/services/outreach-mock-lifecycle.service';
import { UploadProfilesService } from 'src/engine/core-modules/outreach-command/services/upload-profiles.service';

describe('OutreachMockLifecycleService', () => {
  let service: OutreachMockLifecycleService;
  let applyCandidateEvent: jest.Mock;
  let schedule: jest.Mock;
  let clearInboundWindow: jest.Mock;
  let executeGraphQL: jest.Mock;
  let decidePendingHitlForm: jest.Mock;
  let uploadProfilesExecute: jest.Mock;

  beforeEach(async () => {
    applyCandidateEvent = jest.fn().mockResolvedValue(undefined);
    schedule = jest.fn().mockResolvedValue(undefined);
    clearInboundWindow = jest.fn().mockResolvedValue(undefined);
    executeGraphQL = jest.fn().mockResolvedValue({
      candidates: {
        edges: [{ node: { projectsId: 'project-1' } }],
      },
    });
    decidePendingHitlForm = jest.fn().mockResolvedValue({
      ok: true,
      decision: 'approve',
      workflowRunId: 'run-1',
      stepId: 'step-1',
      editedBody: 'Hello',
    });
    uploadProfilesExecute = jest.fn().mockResolvedValue({
      success: true,
      queued: 3,
      projectId: '11111111-1111-4111-8111-111111111111',
      uploadSessionId: 'session-1',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachMockLifecycleService,
        {
          provide: StaticGraphQLService,
          useValue: { executeGraphQL },
        },
        {
          provide: OutreachCommandMaterializeService,
          useValue: { applyCandidateEvent },
        },
        {
          provide: OutreachInboundReplyWindowService,
          useValue: { schedule, clearInboundWindow },
        },
        {
          provide: OutreachCandidateJourneyService,
          useValue: { decidePendingHitlForm },
        },
        {
          provide: UploadProfilesService,
          useValue: { execute: uploadProfilesExecute },
        },
      ],
    }).compile();

    service = module.get(OutreachMockLifecycleService);
  });

  it('acceptConnection materializes connection_accepted', async () => {
    await service.acceptConnection({
      candidateId: 'cand-1',
      apiToken: 'token',
    });

    expect(applyCandidateEvent).toHaveBeenCalledWith({
      candidateId: 'cand-1',
      event: 'connection_accepted',
      apiToken: 'token',
      messagingChannel: 'LINKEDIN_CONNECT',
    });
  });

  it('injectReply schedules a LINKEDIN inbound turn', async () => {
    await service.injectReply({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      apiToken: 'token',
      text: '  interested  ',
      delayMinutes: 0,
    });

    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        candidateId: 'cand-1',
        apiToken: 'token',
        kind: 'outreach',
        channel: 'LINKEDIN',
        delayMinutes: 0,
        turn: expect.objectContaining({
          role: 'user',
          content: 'interested',
        }),
      }),
    );
  });

  it('decideHitlForm resolves project and delegates to journey', async () => {
    const result = await service.decideHitlForm({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      apiToken: 'token',
      decision: 'edit',
      editedBody: 'Changed opener',
    });

    expect(decidePendingHitlForm).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: 'project-1',
      candidateId: 'cand-1',
      decision: 'edit',
      editedBody: 'Changed opener',
      startsAt: undefined,
      endsAt: undefined,
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        candidateId: 'cand-1',
        projectId: 'project-1',
        decision: 'approve',
        editedBody: 'Hello',
      }),
    );
  });

  it('resetFromConnectionRequest clears messages and resets stage', async () => {
    await service.resetFromConnectionRequest({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      apiToken: 'token',
      to: 'CONNECTION_SENT',
    });

    expect(clearInboundWindow).toHaveBeenCalledWith('ws-1', 'cand-1');
    expect(executeGraphQL).toHaveBeenCalledWith(
      graphqlQueryToRemoveMessages,
      {
        filter: {
          candidateId: { eq: 'cand-1' },
        },
      },
      'token',
    );
    expect(executeGraphQL).toHaveBeenCalledWith(
      graphQltoUpdateOneCandidate,
      {
        idToUpdate: 'cand-1',
        input: {
          outreachSequenceStage: 'CONNECTION_SENT',
          outreachConversationStage: 'NONE',
        },
      },
      'token',
    );
  });

  it('resolveResetTarget maps query values', () => {
    expect(service.resolveResetTarget(undefined)).toBe('CONNECTION_SENT');
    expect(service.resolveResetTarget('queued')).toBe('QUEUED');
    expect(() => service.resolveResetTarget('bogus')).toThrow(
      /Invalid reset target/,
    );
  });

  it('resolveHitlDecision maps yes/no/change aliases', () => {
    expect(service.resolveHitlDecision('yes')).toBe('approve');
    expect(service.resolveHitlDecision('no')).toBe('reject');
    expect(service.resolveHitlDecision('change')).toBe('edit');
    expect(() => service.resolveHitlDecision('maybe')).toThrow(
      /Invalid HITL decision/,
    );
  });

  it('uploadMockProfiles queues synthetic people via UploadProfilesService', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';

    const result = await service.uploadMockProfiles({
      workspaceId: 'ws-1',
      projectId,
      count: 3,
    });

    expect(uploadProfilesExecute).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      input: {
        projectId,
        people: expect.arrayContaining([
          expect.objectContaining({
            name: 'Mock Profile 1',
            linkedinProfileId: expect.stringMatching(/^mock-bc-profile-/),
            projectId,
          }),
        ]),
      },
    });
    expect(
      uploadProfilesExecute.mock.calls[0][0].input.people,
    ).toHaveLength(3);
    expect(result).toEqual({
      ok: true,
      projectId,
      count: 3,
      queued: 3,
      uploadSessionId: 'session-1',
    });
  });

  it('uploadMockProfiles rejects invalid projectId', async () => {
    await expect(
      service.uploadMockProfiles({
        workspaceId: 'ws-1',
        projectId: 'not-a-uuid',
        count: 1,
      }),
    ).rejects.toThrow(/valid UUID/);
  });
});
