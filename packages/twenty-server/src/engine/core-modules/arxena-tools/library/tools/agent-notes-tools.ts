import {
  findOneAssistantThread,
  updateOneAssistantThread,
} from 'twenty-shared/graphql';
import { executeGraphQL } from '../api/graphql-client';
import { McpTool } from '../types/tool-types';

type AgentNote = { summary: string; createdAt?: string; id?: string };

function parseAgentNotes(raw: unknown): AgentNote[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is AgentNote => typeof item === 'object' && item !== null && typeof (item as AgentNote).summary === 'string');
}

export const agentNotesTools: McpTool[] = [
  {
    definition: {
      name: 'read_agent_notes',
      description:
        'Read the agent scratch pad (pending notes) for an assistant thread. Use this to see what follow-ups or tasks were recorded for the next run. Returns an array of notes with summary and optional createdAt.',
      inputSchema: {
        type: 'object',
        properties: {
          threadId: { type: 'string', description: 'Assistant thread ID' },
        },
        required: ['threadId'],
      },
    },
    handler: async (args, config) => {
      const threadId = args.threadId as string;

      const data = await executeGraphQL(config.baseUrl, config.apiToken, findOneAssistantThread, { id: threadId });
      const node = (data as { assistantThread?: { agentNotes?: unknown } })?.assistantThread;
      const notes = parseAgentNotes(node?.agentNotes ?? null);

      return {
        threadId,
        count: notes.length,
        notes: notes.map((n) => ({ summary: n.summary, createdAt: n.createdAt, id: n.id })),
      };
    },
  },

  {
    definition: {
      name: 'append_agent_note',
      description:
        'Append a short note to the agent scratch pad for an assistant thread. Use when the agent infers a task (e.g. "Follow up with candidate X – said they\'d connect sometime") so the next heartbeat sees it. The note is stored as JSON with summary and createdAt.',
      inputSchema: {
        type: 'object',
        properties: {
          threadId: { type: 'string', description: 'Assistant thread ID' },
          note: { type: 'string', description: 'Short note text (e.g. "Follow up with candidate X – said they\'d share CV")' },
        },
        required: ['threadId', 'note'],
      },
    },
    handler: async (args, config) => {
      const threadId = args.threadId as string;
      const noteText = (args.note as string)?.trim() ?? '';
      if (!noteText) {
        throw new Error('note must be a non-empty string');
      }

      const data = await executeGraphQL(config.baseUrl, config.apiToken, findOneAssistantThread, { id: threadId });
      const node = (data as { assistantThread?: { agentNotes?: unknown } })?.assistantThread;
      if (!node) {
        throw new Error(`Thread not found: ${threadId}`);
      }

      const existing = parseAgentNotes(node.agentNotes ?? null);
      const newNote: AgentNote = {
        summary: noteText.length > 500 ? noteText.slice(0, 497) + '...' : noteText,
        createdAt: new Date().toISOString(),
      };
      const updated = [...existing, newNote];

      await executeGraphQL(config.baseUrl, config.apiToken, updateOneAssistantThread, {
        id: threadId,
        input: { agentNotes: updated },
      });

      return {
        success: true,
        threadId,
        count: updated.length,
        message: `Appended note. Thread now has ${updated.length} note(s).`,
      };
    },
  },
];
