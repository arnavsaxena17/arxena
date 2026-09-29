import { Test, type TestingModule } from '@nestjs/testing';

import {
  graphQltoUpdateOneCandidate,
  graphqlQueryToRemoveMessages,
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { OutreachInboundReplyWindowService } from 'src/engine/core-modules/outreach-command/jobs/outreach-inbound-reply-window.job';
import { OutreachCandidateJourneyService } from 'src/engine/core-modules/outreach-command/services/outreach-candidate-journey.service';
import { OutreachCommandMaterializeService } from 'src/engine/core-modules/outreach-command/services/outreach-command-materialize.service';
import { OutreachMessagePersistService } from 'src/engine/core-modules/outreach-command/services/outreach-message-persist.service';
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
  let appendOutbound: jest.Mock;

  beforeEach(async () => {
    applyCandidateEvent = jest.fn().mockResolvedValue(undefined);
    schedule = jest.fn().mockResolvedValue(undefined);
    clearInboundWindow = jest.fn().mockResolvedValue(undefined);
    executeGraphQL = jest.fn().mockResolvedValue({
      candidates: {
        edges: [{ node: { projectId: 'project-1' } }],
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
    appendOutbound = jest.fn().mockResolvedValue(undefined);

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
        {
          provide: OutreachMessagePersistService,
          useValue: { appendOutbound },
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

  it('injectGeneratedReply persists an outbound assistant turn', async () => {
    const result = await service.injectGeneratedReply({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      text: '  Thanks for connecting — quick question?  ',
      channel: 'LINKEDIN',
    });

    expect(appendOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        candidateId: 'cand-1',
        channel: 'LINKEDIN',
        body: 'Thanks for connecting — quick question?',
        materializeOutbound: false,
        externalMessageId: expect.stringMatching(/^mock-outbound-cand-1-/),
      }),
    );
    expect(result).toEqual({
      ok: true,
      candidateId: 'cand-1',
      channel: 'LINKEDIN',
    });
  });

  it('resolveTranscriptChannel maps channel aliases', () => {
    expect(service.resolveTranscriptChannel(undefined)).toBe('LINKEDIN');
    expect(service.resolveTranscriptChannel('whatsapp')).toBe('WHATSAPP');
    expect(() => service.resolveTranscriptChannel('sms')).toThrow(
      /Invalid transcript channel/,
    );
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

  it('resetFromConnectionRequest clears messages, stamps connection_sent, and persists the canned note', async () => {
    const result = await service.resetFromConnectionRequest({
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
    expect(appendOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        candidateId: 'cand-1',
        channel: 'LINKEDIN',
        body: 'Hi, thanks for connecting here. Good to e-meet you.',
        materializeOutbound: false,
        allowEmptyBody: true,
        externalMessageId: expect.stringMatching(/^mock-connect-cand-1-/),
      }),
    );
    expect(applyCandidateEvent).toHaveBeenCalledWith({
      candidateId: 'cand-1',
      event: 'connection_sent',
      apiToken: 'token',
      messagingChannel: 'LINKEDIN_CONNECT',
      outboundMessageKind: 'CONNECT_NOTE',
    });
    expect(result.connectionNote).toBe(
      'Hi, thanks for connecting here. Good to e-meet you.',
    );
  });

  it('resetFromConnectionRequest uses a custom note and truncates past 300 characters', async () => {
    const longNote = 'a'.repeat(320);

    const result = await service.resetFromConnectionRequest({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      apiToken: 'token',
      to: 'CONNECTION_SENT',
      connectionNote: longNote,
    });

    expect(result.connectionNote).toHaveLength(300);
    expect(appendOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'a'.repeat(300),
      }),
    );
  });

  it('resetFromConnectionRequest persists a blank connect row when the note is empty', async () => {
    const result = await service.resetFromConnectionRequest({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      apiToken: 'token',
      to: 'CONNECTION_SENT',
      connectionNote: '   ',
    });

    expect(appendOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        body: '',
        allowEmptyBody: true,
      }),
    );
    expect(applyCandidateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'connection_sent' }),
    );
    expect(result.connectionNote).toBe('');
  });

  it('resetFromConnectionRequest to QUEUED does not attach a connection note', async () => {
    const result = await service.resetFromConnectionRequest({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      apiToken: 'token',
      to: 'QUEUED',
      connectionNote: 'Should be ignored',
    });

    expect(appendOutbound).not.toHaveBeenCalled();
    expect(applyCandidateEvent).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      candidateId: 'cand-1',
      outreachSequenceStage: 'QUEUED',
      connectionNote: '',
    });
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
            name: 'Arvind Pathak',
            company: 'Dangote Cement',
            title: 'GMD and CEO',
            linkedinProfileId: 'ACoAAAup_vUBg-znzOwjDf7Ro5xmidw6dCrh58I',
            projectId,
          }),
        ]),
      },
    });
    expect(uploadProfilesExecute.mock.calls[0][0].input.people).toHaveLength(3);
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
