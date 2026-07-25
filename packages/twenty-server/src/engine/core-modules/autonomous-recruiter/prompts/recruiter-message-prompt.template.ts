import type { AgentNote } from 'src/engine/core-modules/assistant/assistant.types';
import type { RecruiterProjectContext } from '../project-context.service';

type BuildRecruiterMessagePromptArgs = {
  userMessage: string;
  jobContext?: RecruiterProjectContext | null;
  agentNotes?: AgentNote[] | null;
};

const MAX_WORDS_HINT = 220;

export const buildRecruiterMessagePrompt = ({
  userMessage,
  jobContext,
  agentNotes,
}: BuildRecruiterMessagePromptArgs): string => {
  const lines: string[] = [];

  lines.push(
    'You are a senior recruiter working inside Arxena. Your job is to help a human recruiter progress real searches with clear, concise, and practical next steps.',
  );
  lines.push('');
  lines.push('**Objectives**');
  lines.push(
    '- Understand the role, company, and current pipeline context for this job.',
  );
  lines.push(
    '- Answer the recruiter’s question directly, focusing on next steps they can take with candidates or the client.',
  );
  lines.push(
    '- When relevant, reference candidate counts, shortlist status, or interview status at a high level (not low-level system details).',
  );
  lines.push('');

  lines.push('**Tone and style**');
  lines.push('- Be concise, professional, and recruiter-to-recruiter.');
  lines.push('- Prefer short paragraphs or bullet points over long essays.');
  lines.push(`- Aim for under ${MAX_WORDS_HINT} words unless the user explicitly asks for more detail.`);
  lines.push('');

  lines.push('**Guardrails**');
  lines.push(
    '- Do not invent personal data (emails, phone numbers, addresses) that is not present in the context.',
  );
  lines.push(
    '- Do not fabricate candidate or client facts; if you are unsure, say what you would check in the system rather than making it up.',
  );
  lines.push(
    '- Avoid sharing sensitive PII beyond what is clearly implied by the recruiter’s question and the job context.',
  );
  lines.push('');

  lines.push('**Project context**');
  if (jobContext) {
    const { jobTitle, companyName, jobLocation, searchName } = jobContext;
    lines.push(
      `- Title: ${jobTitle ?? 'Unknown'}${companyName ? ` at ${companyName}` : ''}`,
    );
    if (jobLocation) {
      lines.push(`- Location: ${jobLocation}`);
    }
    if (searchName) {
      lines.push(`- Internal search name: ${searchName}`);
    }
  } else {
    lines.push('- No specific job is attached to this thread. Use generic recruiter best practices.');
  }
  lines.push('');

  if (agentNotes && agentNotes.length > 0) {
    lines.push('**Key notes from prior runs**');
    agentNotes.slice(0, 5).forEach((note, index) => {
      if (!note?.summary) return;
      lines.push(`- Note ${index + 1}: ${note.summary}`);
    });
    lines.push('');
  }

  lines.push('**Recruiter question**');
  lines.push('The recruiter has just asked:');
  lines.push('');
  lines.push(`"${userMessage.trim()}"`);
  lines.push('');
  lines.push('Respond as the recruiter assistant. Start with a one-line summary, then give concrete next steps.');

  return lines.join('\n');
};

