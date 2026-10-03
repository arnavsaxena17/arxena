import { Test, type TestingModule } from '@nestjs/testing';

import { OutreachDecisionService } from 'src/engine/core-modules/outreach-command/services/outreach-decision.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

type DecisionRow = {
  id: string;
  sourceKey: string;
  status: string;
  title?: string;
  draftBody?: string;
};

describe('OutreachDecisionService', () => {
  let service: OutreachDecisionService;
  let decisions: DecisionRow[];
  let save: jest.Mock;
  let update: jest.Mock;

  beforeEach(async () => {
    decisions = [];
    save = jest.fn(async (row: Omit<DecisionRow, 'id'>) => {
      const saved = { id: 'decision-1', ...row };

      decisions.push(saved);

      return saved;
    });
    update = jest.fn(async (id: string, patch: Partial<DecisionRow>) => {
      const existing = decisions.find((row) => row.id === id);

      if (existing) {
        Object.assign(existing, patch);
      }
    });

    const decisionRepository = {
      findOne: jest.fn(
        async ({ where }: { where: { sourceKey?: string; id?: string } }) =>
          decisions.find(
            (row) =>
              (where.sourceKey !== undefined &&
                row.sourceKey === where.sourceKey) ||
              (where.id !== undefined && row.id === where.id),
          ) ?? null,
      ),
      save,
      update,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachDecisionService,
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: {
            executeInWorkspaceContext: jest.fn(async (fn: () => unknown) =>
              fn(),
            ),
            getRepository: jest.fn(
              async (_workspaceId: string, objectName: string) => {
                if (objectName === 'decision') {
                  return decisionRepository;
                }

                if (objectName === 'candidate') {
                  return {
                    findOne: jest.fn().mockResolvedValue({
                      id: 'candidate-1',
                      projectId: 'project-1',
                      peopleId: 'person-1',
                    }),
                  };
                }

                return {
                  findOne: jest.fn().mockResolvedValue({
                    id: 'person-1',
                    name: { firstName: 'Ada', lastName: 'Lovelace' },
                    jobTitle: 'CFO',
                    companyId: 'company-1',
                  }),
                };
              },
            ),
          },
        },
      ],
    }).compile();

    service = module.get(OutreachDecisionService);
  });

  it('updates the open row when the same form parks again', async () => {
    await service.upsertFromPendingForm({
      workspaceId: 'workspace-1',
      workflowRunId: 'run-1',
      stepId: 'step-1',
      stepName: 'Approve / edit first message',
      candidateId: 'candidate-1',
      draftBody: 'Hello',
    });
    await service.upsertFromPendingForm({
      workspaceId: 'workspace-1',
      workflowRunId: 'run-1',
      stepId: 'step-1',
      stepName: 'Approve / edit first message',
      candidateId: 'candidate-1',
      draftBody: 'Hello again',
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(decisions).toEqual([
      expect.objectContaining({
        id: 'decision-1',
        sourceKey: 'run-1:step-1',
        status: 'OPEN',
        draftBody: 'Hello again',
        title: 'Approve / edit first message · Ada Lovelace',
      }),
    ]);
  });
});
