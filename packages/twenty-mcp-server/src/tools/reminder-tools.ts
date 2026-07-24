import { graphqlQueryToCreateOneReminder, graphqlQueryToFindManyReminders } from 'twenty-shared';
import { executeGraphQL } from '../api/graphql-client';
import { McpTool } from '../types/tool-types';

function addHours(date: Date, hours: number): Date {
  const out = new Date(date);
  out.setTime(out.getTime() + hours * 60 * 60 * 1000);
  return out;
}

function toISOString(date: Date): string {
  return date.toISOString();
}

function extractReminders(data: unknown): Array<{
  id: string;
  candidateId?: string;
  name?: string;
  remindCandidateAtTimestamp?: string;
  remindCandidateDuration?: string;
  isReminderActive?: boolean;
  createdAt?: string;
}> {
  const result = data as {
    candidateReminders?: { edges?: Array<{ node: { id: string; candidateId?: string; name?: string; remindCandidateAtTimestamp?: string; remindCandidateDuration?: string; createdAt?: string } }> };
  };
  const edges = result?.candidateReminders?.edges ?? [];
  return edges.map((e) => e.node);
}

export const reminderTools: McpTool[] = [
  {
    definition: {
      name: 'create_reminder',
      description:
        'Create a reminder to follow up with a candidate after a number of hours. Use when the candidate says they will get back later or when you want to follow up after N hours. The reminder will appear in list_due_reminders when due.',
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: { type: 'string', description: 'Candidate ID' },
          durationHours: {
            type: 'number',
            description: 'Reminder in this many hours from now (e.g. 24 for tomorrow, 48 for 2 days)',
          },
          name: {
            type: 'string',
            description: 'Optional short description (e.g. "Follow up – candidate said they\'d connect")',
          },
        },
        required: ['candidateId', 'durationHours'],
      },
    },
    handler: async (args, config) => {
      const candidateId = args.candidateId as string;
      const durationHours = Number(args.durationHours);
      const name = (args.name as string) ?? `Follow up in ${durationHours} hours`;

      if (!(durationHours > 0 && durationHours < 8760)) {
        throw new Error('durationHours must be between 1 and 8760 (1 year)');
      }

      const now = new Date();
      const remindAt = addHours(now, durationHours);
      const remindAtIso = toISOString(remindAt);

      const input = {
        candidateId,
        remindCandidateDuration: String(durationHours),
        remindCandidateAtTimestamp: remindAtIso,
        name: name.length > 200 ? name.slice(0, 197) + '...' : name,
        isReminderActive: true,
      };

      const result = await executeGraphQL<{ createCandidateReminder?: { id?: string } }>(
        config.baseUrl,
        config.apiToken,
        graphqlQueryToCreateOneReminder,
        { input },
      );

      const id = result?.createCandidateReminder?.id;
      return {
        success: true,
        reminderId: id,
        candidateId,
        remindAt: remindAtIso,
        message: `Reminder set for ${durationHours} hours from now (${remindAtIso}). Use list_due_reminders to see when it is due.`,
      };
    },
  },

  {
    definition: {
      name: 'list_due_reminders',
      description:
        'List reminders that are due or overdue (remindCandidateAtTimestamp <= now) and still active. Use this in the heartbeat to see which candidates need follow-up.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of due reminders to return (default: 50)',
          },
        },
      },
    },
    handler: async (args, config) => {
      const limit = typeof args.limit === 'number' ? args.limit : 50;
      const nowIso = toISOString(new Date());

      const data = await executeGraphQL(config.baseUrl, config.apiToken, graphqlQueryToFindManyReminders, {
        filter: {
          isReminderActive: { eq: true },
          remindCandidateAtTimestamp: { lte: nowIso },
        },
        orderBy: [{ remindCandidateAtTimestamp: 'AscNullsFirst' }],
        limit,
      });

      const reminders = extractReminders(data);
      return {
        count: reminders.length,
        dueReminders: reminders.map((r) => ({
          id: r.id,
          candidateId: r.candidateId,
          name: r.name,
          remindCandidateAtTimestamp: r.remindCandidateAtTimestamp,
          remindCandidateDuration: r.remindCandidateDuration,
        })),
        message:
          reminders.length > 0
            ? `${reminders.length} reminder(s) due. Follow up with these candidates.`
            : 'No due reminders.',
      };
    },
  },
];
