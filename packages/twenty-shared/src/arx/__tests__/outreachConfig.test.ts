import {
  buildDefaultOutreachConfig,
  buildProjectConfigUpdate,
  mergeLegacyProjectFieldsIntoConfig,
  parseOutreachConfig,
  resolveOutreachConfigSendWindowStart,
} from '../outreachConfig';

describe('outreachConfig', () => {
  it('parses legacy flat fields into config JSON', () => {
    const config = mergeLegacyProjectFieldsIntoConfig({
      maxPersonasPerCompany: 3,
      sendTimezone: 'Europe/London',
      sendWindowStart: '09:00',
      sendWindowEnd: '11:00',
      sendWindowDays: '1,2,3',
      icpSpec: JSON.stringify({
        targetTitles: ['CEO'],
        locations: ['London'],
      }),
      experimentConfig: JSON.stringify({
        status: 'running',
        split: 0.5,
      }),
    });

    expect(config.maxPersonasPerCompany).toBe(3);
    expect(config.sendTimezone).toBe('Europe/London');
    expect(config.icpSpec).toEqual({
      targetTitles: ['CEO'],
      locations: ['London'],
    });
    expect(config.experimentConfig?.status).toBe('running');
  });

  it('builds project update with outreachConfig only', () => {
    const update = buildProjectConfigUpdate({
      existingConfig: buildDefaultOutreachConfig(),
      patch: {
        sendWindowStart: '07:30',
      },
    });

    expect(update).toEqual({
      outreachConfig: expect.objectContaining({
        sendWindowStart: '07:30',
        sendWindowEnd: '20:00',
      }),
    });
    expect(update).not.toHaveProperty('sendWindowStart');
  });

  it('resolves send window from JSON before flat fallback', () => {
    expect(
      resolveOutreachConfigSendWindowStart(
        { sendWindowStart: '06:00' },
        '08:00',
      ),
    ).toBe('06:00');
  });

  it('returns null for invalid config input', () => {
    expect(parseOutreachConfig(null)).toBeNull();
    expect(parseOutreachConfig('nope')).toBeNull();
  });
});
