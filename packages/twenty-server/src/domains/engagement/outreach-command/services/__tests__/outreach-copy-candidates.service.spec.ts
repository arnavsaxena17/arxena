import { OutreachCopyCandidatesService } from 'src/domains/engagement/outreach-command/services/outreach-copy-candidates.service';

type Row = Record<string, unknown> & { id: string };

const valuesOf = (filter: unknown): unknown[] => {
  const candidate = filter as { _value?: unknown; value?: unknown };
  const raw = candidate?._value ?? candidate?.value ?? filter;

  return Array.isArray(raw) ? raw : [raw];
};

const matches = (filter: unknown, actual: unknown): boolean =>
  valuesOf(filter).includes(actual);

const buildHarness = ({
  candidates,
  persons,
  targetProject = { id: 'p2', recruiterId: 'm2' },
  save,
}: {
  candidates: Row[];
  persons: Row[];
  targetProject?: Row;
  save?: (row: Record<string, unknown>) => Row;
}) => {
  let created = 0;
  const saved: Row[] = [];

  const candidateRepository = {
    find: async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id !== undefined) {
        return candidates.filter((row) => matches(where.id, row.id));
      }

      if (where.projectId !== undefined && where.peopleId !== undefined) {
        return candidates.filter(
          (row) =>
            row.projectId === where.projectId &&
            matches(where.peopleId, row.peopleId),
        );
      }

      if (where.peopleId !== undefined) {
        return candidates.filter((row) =>
          matches(where.peopleId, row.peopleId),
        );
      }

      return candidates.filter((row) => row.projectId === where.projectId);
    },
    save: async (row: Record<string, unknown>) => {
      created += 1;
      const next = save?.(row) ?? {
        id: `created-${created}`,
        ...row,
      };

      saved.push(next);
      candidates.push(next);

      return next;
    },
  };

  const repositories: Record<string, unknown> = {
    candidate: candidateRepository,
    person: {
      find: async ({ where }: { where: Record<string, unknown> }) =>
        persons.filter((row) => matches(where.id, row.id)),
    },
    project: {
      findOne: async ({ where }: { where: { id: string } }) =>
        where.id === targetProject.id ? targetProject : null,
    },
  };

  const ormManager = {
    executeInWorkspaceContext: async (callback: () => Promise<unknown>) =>
      callback(),
    getRepository: async (_workspaceId: string, objectName: string) =>
      repositories[objectName],
  };

  const service = new OutreachCopyCandidatesService(ormManager as never);

  return { service, saved };
};

const persons = [
  { id: 'pe1', name: { firstName: 'Ada', lastName: 'Lovelace' } },
  { id: 'pe2', name: { firstName: 'Alan', lastName: 'Turing' } },
  { id: 'pe3', name: { firstName: 'Grace', lastName: 'Hopper' } },
  { id: 'pe4', name: { firstName: 'Blocked', lastName: 'Person' } },
];

const run = (
  harness: ReturnType<typeof buildHarness>,
  overrides: Partial<{ sourceProjectId: string; targetProjectId: string }> = {},
) =>
  harness.service.execute({
    workspaceId: 'ws1',
    sourceProjectId: overrides.sourceProjectId ?? 'p1',
    targetProjectId: overrides.targetProjectId ?? 'p2',
  });

describe('OutreachCopyCandidatesService', () => {
  it('should copy cold people into the target project at QUEUED', async () => {
    const harness = buildHarness({
      candidates: [
        {
          id: 'c1',
          projectId: 'p1',
          peopleId: 'pe1',
          name: 'Ada Lovelace',
          outreachSequenceStage: 'CONNECTION_SENT',
        },
        {
          id: 'c2',
          projectId: 'p1',
          peopleId: 'pe2',
          name: 'Alan Turing',
          outreachSequenceStage: 'WAITING_REPLY',
        },
      ],
      persons,
    });

    const result = await run(harness);

    expect(result.copied).toBe(2);
    expect(harness.saved).toHaveLength(2);
    expect(harness.saved[0]).toMatchObject({
      peopleId: 'pe1',
      projectId: 'p2',
      outreachSequenceStage: 'QUEUED',
    });
    // The sender is resolved from the target project's recruiter at run time.
    expect(harness.saved[0]).not.toHaveProperty('outreachWorkspaceMemberId');
  });

  it('should skip do-not-contact people', async () => {
    const harness = buildHarness({
      candidates: [
        {
          id: 'c1',
          projectId: 'p1',
          peopleId: 'pe1',
          outreachSequenceStage: 'CONNECTION_SENT',
        },
        {
          id: 'c4',
          projectId: 'p1',
          peopleId: 'pe4',
          outreachSequenceStage: 'CONNECTION_SENT',
        },
      ],
      persons: [
        ...persons.slice(0, 3),
        {
          id: 'pe4',
          name: { firstName: 'Blocked', lastName: 'Person' },
          doNotContact: true,
        },
      ],
    });

    const result = await run(harness);

    expect(result.copied).toBe(1);
    expect(result.skippedDoNotContact).toBe(1);
  });

  it('should skip people who already have a candidate in the target project', async () => {
    const harness = buildHarness({
      candidates: [
        {
          id: 'c1',
          projectId: 'p1',
          peopleId: 'pe1',
          outreachSequenceStage: 'CONNECTION_SENT',
        },
        {
          id: 'c2',
          projectId: 'p2',
          peopleId: 'pe1',
          outreachSequenceStage: 'QUEUED',
        },
      ],
      persons,
    });

    const result = await run(harness);

    expect(result.copied).toBe(0);
    expect(result.skippedAlreadyInProject).toBe(1);
  });

  it('should skip people who already replied or booked in any project', async () => {
    const harness = buildHarness({
      candidates: [
        {
          id: 'c1',
          projectId: 'p1',
          peopleId: 'pe1',
          outreachSequenceStage: 'CONNECTION_SENT',
        },
        {
          id: 'c2',
          projectId: 'p1',
          peopleId: 'pe2',
          outreachSequenceStage: 'CONNECTION_SENT',
        },
        {
          id: 'c3',
          projectId: 'p9',
          peopleId: 'pe2',
          outreachSequenceStage: 'REPLIED',
        },
        {
          id: 'c4',
          projectId: 'p1',
          peopleId: 'pe3',
          outreachSequenceStage: 'CONNECTION_SENT',
        },
        {
          id: 'c5',
          projectId: 'p9',
          peopleId: 'pe3',
          outreachSequenceStage: 'MEETING_BOOKED',
        },
      ],
      persons,
    });

    const result = await run(harness);

    expect(result.copied).toBe(1);
    expect(result.skippedEngaged).toBe(2);
  });

  it('should never write a sender on the copied row', async () => {
    const harness = buildHarness({
      candidates: [
        {
          id: 'c1',
          projectId: 'p1',
          peopleId: 'pe1',
          outreachSequenceStage: 'CONNECTION_SENT',
        },
      ],
      persons,
    });

    await run(harness);

    expect(harness.saved[0]).not.toHaveProperty('outreachWorkspaceMemberId');
  });

  it('should reject copying a project into itself', async () => {
    const harness = buildHarness({ candidates: [], persons });

    await expect(
      run(harness, { sourceProjectId: 'p1', targetProjectId: 'p1' }),
    ).rejects.toThrow('Select a different project');
  });

  it('should copy only the requested candidates that belong to the source', async () => {
    const harness = buildHarness({
      candidates: [
        {
          id: 'c1',
          projectId: 'p1',
          peopleId: 'pe1',
          outreachSequenceStage: 'CONNECTION_SENT',
        },
        {
          id: 'c2',
          projectId: 'p1',
          peopleId: 'pe2',
          outreachSequenceStage: 'CONNECTION_SENT',
        },
        {
          id: 'c3',
          projectId: 'p9',
          peopleId: 'pe3',
          outreachSequenceStage: 'CONNECTION_SENT',
        },
      ],
      persons,
    });

    const result = await harness.service.execute({
      workspaceId: 'ws1',
      sourceProjectId: 'p1',
      targetProjectId: 'p2',
      candidateIds: ['c1', 'c3'],
    });

    expect(result.copied).toBe(1);
    expect(harness.saved[0]).toMatchObject({ peopleId: 'pe1' });
  });
});
