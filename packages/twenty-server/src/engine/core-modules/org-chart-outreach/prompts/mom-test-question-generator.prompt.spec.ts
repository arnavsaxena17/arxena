import {
  ARXENA_MOM_TEST_DEFAULTS,
  buildMomTestSystemPrompt,
  buildMomTestUserMessage,
  formatLinkedinProfileAsResumeText,
} from './mom-test-question-generator.prompt';

describe('mom-test-question-generator.prompt', () => {
  it('builds a system prompt with all six strategy slots and Mom Test rules', () => {
    const system = buildMomTestSystemPrompt();
    console.log('Mom Test system prompt length:', system.length);

    expect(system).toContain(ARXENA_MOM_TEST_DEFAULTS.productContext);
    expect(system).toContain('[T] Targeting');
    expect(system).toContain(ARXENA_MOM_TEST_DEFAULTS.hypothesisT);
    expect(system).toContain('[M] Multi-threading');
    expect(system).toContain('[M-r] Retention flavor');
    expect(system).toContain('[V] Visibility');
    expect(system).toContain('SDR / BDR');
    expect(system).toContain('must NEVER appear in the questions');
    expect(system).toContain('I see on your CV');
    expect(system).toContain('listen_for');
    expect(system).toContain('trap_check');
    expect(system).toContain(ARXENA_MOM_TEST_DEFAULTS.geoDefaults);
  });

  it('keeps interview context in the user message only', () => {
    const user = buildMomTestUserMessage({
      resumeText: 'Jane Doe\nVP Sales @ Acme',
      interviewContext: 'rejected candidate, warm relationship',
    });
    console.log('Mom Test user message:', user);

    expect(user).toContain('<resume>');
    expect(user).toContain('Jane Doe');
    expect(user).toContain('Optional context: rejected candidate');
    expect(user).not.toContain(ARXENA_MOM_TEST_DEFAULTS.productContext);
  });

  it('formats a LinkedIn profile into resume-like text with anchors', () => {
    const resume = formatLinkedinProfileAsResumeText({
      first_name: 'Deepak',
      last_name: 'Sharma',
      headline: 'VP Sales | Ex-ZoomInfo',
      location: 'Mumbai, India',
      summary: 'Built enterprise outbound for BFSI.',
      work_experience: [
        {
          company: 'Acme',
          position: 'VP Sales',
          description: 'Managed ABM with ZoomInfo and HubSpot for BFSI.',
          start: '1/1/2022',
          end: null,
        },
      ],
      skills: [{ name: 'ZoomInfo' }, { name: 'HubSpot' }],
    });
    console.log('Formatted resume:\n', resume);

    expect(resume).toContain('Deepak Sharma');
    expect(resume).toContain('Mumbai, India');
    expect(resume).toContain('VP Sales @ Acme');
    expect(resume).toContain('ZoomInfo');
    expect(resume).toContain('HubSpot');
  });
});
