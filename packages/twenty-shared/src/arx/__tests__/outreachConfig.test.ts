import {
  buildDefaultOutreachConfig,
  buildProjectConfigUpdate,
  mergeLegacyProjectFieldsIntoConfig,
  parseOutreachConfig,
  resolveOutreachConfigPersonaGuidance,
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
        sendWindowEnd: '23:59',
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

  it('keeps persona guidance across unrelated patches', () => {
    const { outreachConfig: withGuidance } = buildProjectConfigUpdate({
      existingConfig: buildDefaultOutreachConfig(),
      patch: { personaGuidance: '  CFOs: lead with margin.  ' },
    });
    const { outreachConfig: afterSchedulePatch } = buildProjectConfigUpdate({
      existingConfig: withGuidance,
      patch: { sendTimezone: 'Europe/London' },
    });

    expect(withGuidance.personaGuidance).toBe('CFOs: lead with margin.');
    expect(resolveOutreachConfigPersonaGuidance(afterSchedulePatch)).toBe(
      'CFOs: lead with margin.',
    );
  });

  it('clears persona guidance when saved empty', () => {
    const { outreachConfig } = buildProjectConfigUpdate({
      existingConfig: { v: 1, personaGuidance: 'CFOs: lead with margin.' },
      patch: { personaGuidance: '   ' },
    });

    expect(outreachConfig.personaGuidance).toBeNull();
    expect(resolveOutreachConfigPersonaGuidance(outreachConfig)).toBe('');
  });
});
