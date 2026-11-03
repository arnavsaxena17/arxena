import {
  FindPeopleByCompanyInputZodSchema,
  FIND_PEOPLE_PILOT_SIZE,
  FIND_PEOPLE_PILOT_THRESHOLD,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company-tool.schema';

describe('FindPeopleByCompanyInputZodSchema', () => {
  it('should accept a target with best-effort bounding', () => {
    const parsed = FindPeopleByCompanyInputZodSchema.safeParse({
      fromProject: true,
      projectId: 'p',
      roles: ['Sales Head'],
      target: 10,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.target).toBe(10);
  });

  it('should reject an unknown key instead of dropping it', () => {
    // `industries` and a misspelled `targets` used to vanish silently, which
    // let the model believe it had bounded a run that then spent on every row
    const parsed = FindPeopleByCompanyInputZodSchema.safeParse({
      fromProject: true,
      projectId: 'p',
      roles: ['Sales Head'],
      industries: 'Pharmaceutical Manufacturing',
    });

    expect(parsed.success).toBe(false);
  });

  it('should reject a target below 1', () => {
    const parsed = FindPeopleByCompanyInputZodSchema.safeParse({
      companies: [{ name: 'Acme' }],
      roles: ['CEO'],
      target: 0,
    });

    expect(parsed.success).toBe(false);
  });

  it('should default skipPilot off and keep pilotSize optional', () => {
    const parsed = FindPeopleByCompanyInputZodSchema.safeParse({
      companies: [{ name: 'Acme' }],
      roles: ['CEO'],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.skipPilot).toBe(false);
    expect(parsed.success && parsed.data.pilotSize).toBeUndefined();
    expect(FIND_PEOPLE_PILOT_THRESHOLD).toBe(25);
    expect(FIND_PEOPLE_PILOT_SIZE).toBe(10);
  });
});
