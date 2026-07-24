import { CalendlyBookingCompletedService } from 'src/engine/core-modules/website-leads/calendly-booking-completed.service';
import { OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

describe('CalendlyBookingCompletedService', () => {
  const workspaceId = '635976bf-1483-4259-8a3b-eed5cd4e87f1';

  const createService = ({
    person = null,
    opportunities = [],
  }: {
    person?: { id: string; emails: { primaryEmail: string } } | null;
    opportunities?: Array<{ id: string; name: string; pointOfContactId: string }>;
  }) => {
    const personRepository = {
      findOne: jest.fn().mockResolvedValue(person),
    };

    const opportunityRepository = {
      find: jest.fn().mockResolvedValue(opportunities),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const twentyORMGlobalManager = {
      getRepositoryForWorkspace: jest
        .fn()
        .mockImplementation((_workspace: string, entity: unknown) => {
          if (entity === PersonWorkspaceEntity) {
            return Promise.resolve(personRepository);
          }

          if (entity === OpportunityWorkspaceEntity) {
            return Promise.resolve(opportunityRepository);
          }

          throw new Error('Unexpected entity');
        }),
    };

    const environmentService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'FREE_TRIAL_LEAD_WORKSPACE_ID') {
          return workspaceId;
        }

        return undefined;
      }),
    };

    return {
      service: new CalendlyBookingCompletedService(
        twentyORMGlobalManager as never,
        environmentService as never,
      ),
      opportunityRepository,
    };
  };

  it('marks the latest free trial opportunity as meeting scheduled', async () => {
    const { service, opportunityRepository } = createService({
      person: {
        id: 'person-1',
        emails: { primaryEmail: 'arnav@arxorg.com' },
      },
      opportunities: [
        {
          id: 'opp-1',
          name: 'Free Trial — Arnav Saxena @ arxorg',
          pointOfContactId: 'person-1',
        },
      ],
    });

    const result = await service.markMeetingScheduledForLead({
      email: 'arnav@arxorg.com',
      calendlyPayload: {
        event: { uri: 'https://api.calendly.com/scheduled_events/abc' },
        invitee: {
          uri: 'https://api.calendly.com/scheduled_events/abc/invitees/def',
        },
      },
    });

    console.log('calendly booking result', result);

    expect(result).toMatchObject({
      opportunityId: 'opp-1',
      personId: 'person-1',
    });
    expect(opportunityRepository.update).toHaveBeenCalledWith(
      'opp-1',
      expect.objectContaining({
        stage: 'MEETING',
        meetingScheduledAt: expect.any(Date),
      }),
    );
  });
});
