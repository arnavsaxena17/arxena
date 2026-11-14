import moment from 'moment-timezone';

import { GetCalendarAvailabilityService } from '../get-calendar-availability.service';

describe('GetCalendarAvailabilityService', () => {
  const googleCalendarService = {
    authorize: jest.fn(),
    listEvents: jest.fn(),
  };
  const gtmWorkspaceAuthTokenService = {
    resolveOrMint: jest.fn(),
  };

  const service = new GetCalendarAvailabilityService(
    googleCalendarService as never,
    gtmWorkspaceAuthTokenService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const assertDefaultIstWindow = (slots: Array<{ startsAt: string }>) => {
    expect(slots.length).toBeGreaterThan(0);

    for (const slot of slots) {
      const start = moment(slot.startsAt).tz('Asia/Kolkata');

      expect(start.isoWeekday()).toBeLessThanOrEqual(5);
      expect(start.hour()).toBeGreaterThanOrEqual(10);
      expect(start.hour()).toBeLessThan(17);
    }
  };

  it('returns default 10:00–17:00 IST slots when Google Calendar is not connected', async () => {
    gtmWorkspaceAuthTokenService.resolveOrMint.mockResolvedValue('token');
    googleCalendarService.authorize.mockResolvedValue({
      credentials: {},
    });

    const result = await service.execute({
      workspaceId: 'workspace-1',
      input: { days: 5, slotMinutes: 30 },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBe('');
    expect(googleCalendarService.listEvents).not.toHaveBeenCalled();
    assertDefaultIstWindow(result.slots);
  });

  it('returns default 10:00–17:00 IST slots when calendar fetch throws', async () => {
    gtmWorkspaceAuthTokenService.resolveOrMint.mockResolvedValue('token');
    googleCalendarService.authorize.mockResolvedValue({
      credentials: { refresh_token: 'refresh' },
    });
    googleCalendarService.listEvents.mockRejectedValue(
      new Error('No access token found'),
    );

    const result = await service.execute({
      workspaceId: 'workspace-1',
      input: { days: 5, slotMinutes: 30 },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBe('');
    assertDefaultIstWindow(result.slots);
  });

  it('returns default slots when workspace API token is missing', async () => {
    gtmWorkspaceAuthTokenService.resolveOrMint.mockResolvedValue('');

    const result = await service.execute({
      workspaceId: 'workspace-1',
      input: {},
    });

    expect(result.success).toBe(true);
    expect(googleCalendarService.authorize).not.toHaveBeenCalled();
    assertDefaultIstWindow(result.slots);
  });
});
