import type { AgentNote } from 'src/engine/core-modules/assistant/assistant.types';
import type { RecruiterJobContext } from '../../job-context.service';
import { buildRecruiterMessagePrompt } from '../recruiter-message-prompt.template';

describe('buildRecruiterMessagePrompt', () => {
  const baseContext: RecruiterJobContext = {
    jobId: 'job-1',
    jobTitle: 'Senior React Developer',
    companyName: 'Mock Product Co',
    jobLocation: 'Bangalore',
    searchName: 'Senior React – Bangalore',
  };

  const notes: AgentNote[] = [
    { summary: 'Client prefers product companies with fintech/SaaS focus.' },
    { summary: 'Target 5–8 years experience, hands-on React.' },
  ];

  it('includes recruiter role, objectives, job context, notes, and user message', () => {
    const userMessage = 'Can you draft a client update based on the latest shortlist status?';

    const prompt = buildRecruiterMessagePrompt({
      userMessage,
      jobContext: baseContext,
      agentNotes: notes,
    });

    expect(prompt).toContain('You are a senior recruiter');
    expect(prompt).toContain('**Objectives**');
    expect(prompt).toContain('**Tone and style**');
    expect(prompt).toContain('**Guardrails**');
    expect(prompt).toContain('**Job context**');
    expect(prompt).toContain('Senior React Developer');
    expect(prompt).toContain('Mock Product Co');
    expect(prompt).toContain('Bangalore');
    expect(prompt).toContain('Senior React – Bangalore');
    expect(prompt).toContain('**Key notes from prior runs**');
    expect(prompt).toContain(notes[0].summary);
    expect(prompt).toContain(notes[1].summary);
    expect(prompt).toContain('**Recruiter question**');
    expect(prompt).toContain(userMessage);
  });

  it('handles missing job context gracefully', () => {
    const prompt = buildRecruiterMessagePrompt({
      userMessage: 'Who should I follow up with next?',
      jobContext: null,
      agentNotes: [],
    });

    expect(prompt).toContain('No specific job is attached to this thread');
  });

  it('mentions safeguard guidance around PII and fabrication', () => {
    const prompt = buildRecruiterMessagePrompt({
      userMessage: 'Summarize why these candidates are a good fit.',
      jobContext: baseContext,
      agentNotes: [],
    });

    expect(prompt).toMatch(/Do not invent personal data/i);
    expect(prompt).toMatch(/Do not fabricate candidate or client facts/i);
    expect(prompt).toMatch(/Avoid sharing sensitive PII/i);
  });
});

