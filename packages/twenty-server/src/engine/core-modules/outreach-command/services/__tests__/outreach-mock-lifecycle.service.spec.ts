import { Test, type TestingModule } from '@nestjs/testing';

import { graphQltoUpdateOneCandidate, graphqlQueryToRemoveMessages } from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { OutreachInboundReplyWindowService } from 'src/engine/core-modules/outreach-command/jobs/outreach-inbound-reply-window.job';
import { OutreachCommandMaterializeService } from 'src/engine/core-modules/outreach-command/services/outreach-command-materialize.service';
import { OutreachMockLifecycleService } from 'src/engine/core-modules/outreach-command/services/outreach-mock-lifecycle.service';

describe('OutreachMockLifecycleService', () => {
  let service: OutreachMockLifecycleService;
  let applyCandidateEvent: jest.Mock;
  let schedule: jest.Mock;
  let clearInboundWindow: jest.Mock;
  let executeGraphQL: jest.Mock;

  beforeEach(async () => {
    applyCandidateEvent = jest.fn().mockResolvedValue(undefined);
    schedule = jest.fn().mockResolvedValue(undefined);
    clearInboundWindow = jest.fn().mockResolvedValue(undefined);
    executeGraphQL = jest.fn().mockResolvedValue({});

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
});
