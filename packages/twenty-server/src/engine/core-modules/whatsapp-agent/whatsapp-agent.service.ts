import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { randomUUID } from 'crypto';
import { appendFileSync } from 'fs';
import { DataSource, Repository } from 'typeorm';

import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AiBillingService } from 'src/engine/metadata-modules/ai/ai-billing/services/ai-billing.service';
import { AgentChatService } from 'src/engine/metadata-modules/ai/ai-chat/services/agent-chat.service';
import { AgentChatStreamingService } from 'src/engine/metadata-modules/ai/ai-chat/services/agent-chat-streaming.service';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import type {
  AskQuestionAnswer,
  AskQuestionItem,
} from 'twenty-shared/ai';

const MAX_WHATSAPP_TEXT_LENGTH = 4000;
const REPLY_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 2_000;
const DEBUG_LOG_PATH = '/tmp/wa-agent.log';

type WhatsappInboundMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
};

export type WhatsappChangeValue = {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  messages?: WhatsappInboundMessage[];
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
};

type StoredToolOutput =
  | { result?: { questions?: AskQuestionItem[] } }
  | null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class WhatsappAgentService {
  private readonly logger = new Logger(WhatsappAgentService.name);
  private readonly seenWamids = new Map<string, number>();
  private readonly threadProjectUrls = new Map<string, string>();

  private readonly agentPhoneNumberId =
    process.env.WHATSAPP_AGENT_PHONE_NUMBER_ID ?? '';
  private readonly apiToken = process.env.WHATSAPP_AGENT_API_TOKEN ?? '';
  private readonly graphVersion =
    process.env.WHATSAPP_AGENT_GRAPH_VERSION ?? 'v21.0';

  constructor(
    private readonly agentChatService: AgentChatService,
    private readonly agentChatStreamingService: AgentChatStreamingService,
    private readonly aiModelRegistryService: AiModelRegistryService,
    private readonly aiBillingService: AiBillingService,
    private readonly workspaceDomainsService: WorkspaceDomainsService,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  isAgentNumber(phoneNumberId?: string): boolean {
    return isNonEmpty(phoneNumberId) && phoneNumberId === this.agentPhoneNumberId;
  }

  async handleInbound(value: WhatsappChangeValue): Promise<void> {
    const message = value.messages?.[0];

    if (!isNonEmpty(message?.from)) {
      return;
    }

    const fromPhone = message.from;
    const wamid = message.id;

    if (isNonEmpty(wamid) && this.isDuplicate(wamid)) {
      this.debug('duplicate-wamid', { wamid });
      return;
    }

    const phoneE164 = `+${fromPhone.replace(/\D/g, '')}`;

    try {
      await this.routeMessage({ message, phoneE164, fromPhone });
    } catch (error) {
      this.debug('handler-error', { error: errorMessage(error) });
      this.logger.error(`WhatsApp agent inbound failed: ${errorMessage(error)}`);
      await this.sendText(
        fromPhone,
        'Sorry — something went wrong on my side. Try again in a moment.',
      );
    }
  }

  private async routeMessage({
    message,
    phoneE164,
    fromPhone,
  }: {
    message: WhatsappInboundMessage;
    phoneE164: string;
    fromPhone: string;
  }): Promise<void> {
    const userWorkspace = await this.userWorkspaceRepository.findOne({
      where: { whatsappPhoneE164: phoneE164 },
    });

    if (!userWorkspace) {
      this.debug('unknown-phone', { phoneE164 });
      await this.sendText(
        fromPhone,
        'Arxena is invite-only. Ask your admin to invite this number — they will need the email you sign in with.',
      );
      return;
    }

    if (userWorkspace.whatsappStatus === 'PAUSED' || userWorkspace.whatsappStatus === 'BLOCKED') {
      return;
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: userWorkspace.workspaceId },
    });

    if (!workspace) {
      this.debug('workspace-missing', { workspaceId: userWorkspace.workspaceId });
      return;
    }

    const text = extractText(message);

    if (!isNonEmpty(text)) {
      await this.sendText(
        fromPhone,
        'I can only read text messages for now — voice notes and files are coming.',
      );
      return;
    }

    this.debug('inbound', {
      phoneE164,
      workspaceId: workspace.id,
      text: text.slice(0, 120),
    });

    await this.userWorkspaceRepository.update(userWorkspace.id, {
      whatsappLastInboundAt: new Date(),
    });

    const threadId = await this.resolveThread(userWorkspace, workspace.id);
    const startedAt = new Date();
    const modelId = workspace.smartModel;

    this.aiModelRegistryService.validateModelAvailability(modelId, workspace);
    await this.aiBillingService.assertHasAvailableCreditsOrThrow(
      workspace.id,
      modelId,
    );

    // A pending question must be answered, not queued behind — otherwise the thread stalls forever.
    const pendingQuestion = await this.getPendingQuestion(threadId);

    if (pendingQuestion) {
      const answers = buildAnswers(text, pendingQuestion.questions);

      if (answers.length === 0) {
        await this.sendText(
          fromPhone,
          renderPendingQuestionPrompt(pendingQuestion.questions),
        );
        return;
      }

      this.debug('answering-question', {
        threadId,
        answers: JSON.stringify(answers),
      });

      await this.agentChatStreamingService.answerPendingQuestionAndResumeStream({
        threadId,
        messageId: pendingQuestion.messageId,
        answers,
        userWorkspaceId: userWorkspace.id,
        workspace,
        modelId,
      });

      const answeredReply = await this.waitForReply({ threadId, since: startedAt });

      if (isNonEmpty(answeredReply)) {
        await this.sendFormattedReply({
          to: fromPhone,
          workspace,
          text: answeredReply,
          threadId,
        });
      }

      return;
    }

    const streamResult = await this.agentChatStreamingService.streamAgentChat({
      threadId,
      userWorkspaceId: userWorkspace.id,
      workspace,
      text,
      browsingContext: null,
      messageId: randomUUID(),
    });

    this.debug('queued', {
      threadId,
      queued: streamResult.queued,
      streamId: 'streamId' in streamResult ? streamResult.streamId : null,
    });

    const reply = await this.waitForReply({ threadId, since: startedAt });

    if (!isNonEmpty(reply)) {
      await this.sendText(
        fromPhone,
        'That took longer than I can hold the chat open. Try asking again in a moment.',
      );
      return;
    }

    await this.sendFormattedReply({
      to: fromPhone,
      workspace,
      text: reply,
      threadId,
    });
  }

  private async resolveThread(
    userWorkspace: UserWorkspaceEntity,
    workspaceId: string,
  ): Promise<string> {
    if (isNonEmpty(userWorkspace.whatsappActiveThreadId)) {
      const existing: Array<{ id: string; deletedAt: Date | null }> =
        await this.dataSource.query(
          `SELECT id, "deletedAt" FROM core."agentChatThread" WHERE id = $1 AND "workspaceId" = $2 LIMIT 1`,
          [userWorkspace.whatsappActiveThreadId, workspaceId],
        );

      if (existing[0] && !existing[0].deletedAt) {
        return existing[0].id;
      }
    }

    const thread = await this.agentChatService.createThread({
      userWorkspaceId: userWorkspace.id,
      workspaceId,
    });

    await this.userWorkspaceRepository.update(userWorkspace.id, {
      whatsappActiveThreadId: thread.id,
    });

    return thread.id;
  }

  private async getPendingQuestion(
    threadId: string,
  ): Promise<{ messageId: string; questions: AskQuestionItem[] } | null> {
    const threadRows: Array<{ pendingQuestionMessageId: string | null }> =
      await this.dataSource.query(
        `SELECT "pendingQuestionMessageId" FROM core."agentChatThread" WHERE id = $1`,
        [threadId],
      );

    const messageId = threadRows[0]?.pendingQuestionMessageId;

    if (!isNonEmpty(messageId)) {
      return null;
    }

    const partRows: Array<{ toolOutput: StoredToolOutput }> =
      await this.dataSource.query(
        `SELECT "toolOutput" FROM core."agentMessagePart"
         WHERE "messageId" = $1 AND type LIKE '%ask_questions%' LIMIT 1`,
        [messageId],
      );

    const questions = partRows[0]?.toolOutput?.result?.questions ?? [];

    if (questions.length === 0) {
      return null;
    }

    return { messageId, questions };
  }

  private async waitForReply({
    threadId,
    since,
  }: {
    threadId: string;
    since: Date;
  }): Promise<string | null> {
    const deadline = Date.now() + REPLY_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const threadRows: Array<{ activeStreamId: string | null }> =
        await this.dataSource.query(
          `SELECT "activeStreamId" FROM core."agentChatThread" WHERE id = $1`,
          [threadId],
        );

      const assistantRows: Array<{ id: string }> = await this.dataSource.query(
        `SELECT id FROM core."agentMessage"
         WHERE "threadId" = $1 AND role = 'assistant' AND "createdAt" > $2
         ORDER BY "createdAt" DESC LIMIT 1`,
        [threadId, since],
      );

      if (assistantRows.length === 0) {
        continue;
      }

      const parts: Array<{ type: string; textContent: string | null }> =
        await this.dataSource.query(
          `SELECT type, "textContent" FROM core."agentMessagePart"
           WHERE "messageId" = $1 ORDER BY "orderIndex" ASC`,
          [assistantRows[0].id],
        );

      const text = parts
        .filter((part) => part.type === 'text' && isNonEmpty(part.textContent))
        .map((part) => part.textContent as string)
        .join('\n\n')
        .trim();

      const streamDone = !isNonEmpty(threadRows[0]?.activeStreamId);

      if (isNonEmpty(text) && streamDone) {
        return text;
      }
    }

    return null;
  }

  private async sendFormattedReply({
    to,
    workspace,
    text,
    threadId,
  }: {
    to: string;
    workspace: WorkspaceEntity;
    text: string;
    threadId: string;
  }): Promise<void> {
    const formatted = formatForWhatsapp(text);
    const matchedUrl = await this.findProjectUrl(workspace, text).catch(
      () => null,
    );

    if (isNonEmpty(matchedUrl)) {
      this.threadProjectUrls.set(threadId, matchedUrl);
    }

    // Keep linking to the project once the agent has committed to it, even when a later
    // progress message no longer mentions the name.
    const projectUrl = matchedUrl ?? this.threadProjectUrls.get(threadId) ?? null;

    await this.sendText(
      to,
      projectUrl ? `${formatted}\n\nOpen in Arxena → ${projectUrl}` : formatted,
    );
  }

  private async findProjectUrl(
    workspace: WorkspaceEntity,
    text: string,
  ): Promise<string | null> {
    const schema = getWorkspaceSchemaName(workspace.id);
    const rows: Array<{ id: string; name: string | null }> =
      await this.dataSource.query(
        `SELECT id, name FROM "${schema}"."_project" WHERE "deletedAt" IS NULL LIMIT 500`,
      );

    if (rows.length === 0) {
      return null;
    }

    const lowered = text.toLowerCase();
    const match = rows
      .filter(
        (row) =>
          typeof row.name === 'string' &&
          row.name.length > 3 &&
          lowered.includes(row.name.toLowerCase()),
      )
      .sort((left, right) => (right.name ?? '').length - (left.name ?? '').length)[0];

    if (!match) {
      return null;
    }

    return this.workspaceDomainsService
      .buildWorkspaceURL({ workspace, pathname: `/objects/projects/${match.id}` })
      .toString();
  }

  private async sendText(to: string, body: string): Promise<void> {
    if (!isNonEmpty(this.agentPhoneNumberId) || !isNonEmpty(this.apiToken)) {
      this.debug('send-skipped-no-config', {});
      return;
    }

    for (const chunk of chunkText(body, MAX_WHATSAPP_TEXT_LENGTH)) {
      const response = await fetch(
        `https://graph.facebook.com/${this.graphVersion}/${this.agentPhoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: chunk, preview_url: false },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();

        this.debug('send-failed', {
          status: response.status,
          body: errorBody.slice(0, 300),
        });
        this.logger.error(
          `WhatsApp send failed (${response.status}): ${errorBody.slice(0, 300)}`,
        );
      } else {
        this.debug('sent', { to, length: chunk.length });
      }
    }
  }

  private isDuplicate(wamid: string): boolean {
    const now = Date.now();
    const seenAt = this.seenWamids.get(wamid);

    if (seenAt && now - seenAt < 24 * 60 * 60 * 1000) {
      return true;
    }

    this.seenWamids.set(wamid, now);

    if (this.seenWamids.size > 1000) {
      for (const [key, value] of this.seenWamids) {
        if (now - value > 24 * 60 * 60 * 1000) {
          this.seenWamids.delete(key);
        }
      }
    }

    return false;
  }

  private debug(event: string, data: Record<string, unknown>): void {
    try {
      appendFileSync(
        DEBUG_LOG_PATH,
        `${new Date().toISOString()} ${event} ${JSON.stringify(data)}\n`,
      );
    } catch {
      // debugging output must never break message handling
    }
  }
}

const isNonEmpty = (value?: string | null): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const extractText = (message: WhatsappInboundMessage): string | null => {
  if (isNonEmpty(message.text?.body)) {
    return message.text.body;
  }

  if (isNonEmpty(message.button?.text)) {
    return message.button.text;
  }

  const interactiveReply =
    message.interactive?.button_reply ?? message.interactive?.list_reply;

  if (isNonEmpty(interactiveReply?.title)) {
    return interactiveReply.title;
  }

  return null;
};

const chunkText = (text: string, limit: number): string[] => {
  const trimmed = text.trim();

  if (trimmed.length <= limit) {
    return [trimmed];
  }

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const breakAt = Math.max(
      window.lastIndexOf('\n\n'),
      window.lastIndexOf('\n'),
      window.lastIndexOf('. '),
    );
    const cut = breakAt > limit * 0.5 ? breakAt + 1 : limit;

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
};

const buildAnswers = (
  text: string,
  questions: AskQuestionItem[],
): AskQuestionAnswer[] => {
  const tokens = text
    .split(/[,;\n]+|\band\b/gi)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const answers: AskQuestionAnswer[] = [];
  let questionIndex = 0;

  for (const token of tokens) {
    if (questionIndex >= questions.length) {
      break;
    }

    const question = questions[questionIndex];
    const numeric = /^\d+$/.test(token) ? Number.parseInt(token, 10) : null;

    if (
      numeric !== null &&
      numeric >= 1 &&
      numeric <= question.options.length
    ) {
      answers.push({
        questionIndex,
        selectedOptionIndices: [numeric - 1],
      });
      questionIndex += 1;
      continue;
    }

    const lowered = token.toLowerCase();
    const matchingIndex = question.options.findIndex(
      (option) =>
        option.label.toLowerCase() === lowered ||
        option.label.toLowerCase().startsWith(lowered),
    );

    if (matchingIndex >= 0) {
      answers.push({ questionIndex, selectedOptionIndices: [matchingIndex] });
      questionIndex += 1;
      continue;
    }

    if (question.allowFreeText) {
      answers.push({
        questionIndex,
        selectedOptionIndices: [],
        freeText: token,
      });
      questionIndex += 1;
    }
  }

  return answers;
};

const renderPendingQuestionPrompt = (questions: AskQuestionItem[]): string => {
  const lines = [
    'I need a quick answer before I can run this:',
    '',
  ];

  questions.forEach((question, questionIndex) => {
    lines.push(`${questionIndex + 1}. ${question.question}`);
    question.options.forEach((option, optionIndex) => {
      lines.push(
        `   ${optionIndex + 1}) ${option.label}${option.isRecommended ? ' (recommended)' : ''}`,
      );
    });
    lines.push('');
  });

  lines.push(`Reply like "1, 1" — one number per question.`);

  return lines.join('\n');
};

// WhatsApp renders *bold*, _italic_ and plain lines. Markdown tables and headings are noise there.
export const formatForWhatsapp = (markdown: string): string => {
  const lines = markdown.split('\n');
  const output: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (/^\s*\|?[\s:-]*\|[\s:|-]*\|?\s*$/.test(line) && line.includes('|')) {
      continue;
    }

    if (/^\s*#{1,6}\s+/.test(line)) {
      output.push(`*${line.replace(/^\s*#{1,6}\s+/, '').trim()}*`);
      continue;
    }

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      if (cells.length > 1) {
        output.push(`${cells[0]}: ${cells.slice(1).join(' · ')}`);
        continue;
      }
    }

    output.push(
      line
        .replace(/\*\*(.+?)\*\*/g, '*$1*')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)')
        .replace(/`([^`]+)`/g, '$1'),
    );
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
