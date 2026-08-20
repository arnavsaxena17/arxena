import { HttpException, Injectable, Logger, Optional } from '@nestjs/common';

import {
  extractUnipileListItems,
  extractUnipileNextCursor,
  normalizeUnipileV2Account,
} from './normalize-unipile-v2-account.util';
import {
  buildUnipileV2LinkedInSearchPath,
  isPremiumLinkedInSearchApi,
  mapUnipileV2SearchBody,
  normalizeUnipileV2SearchItems,
  UNIPILE_V2_CLASSIC_SEARCH_MAX_RESULTS,
  UNIPILE_V2_PREMIUM_SEARCH_MAX_RESULTS,
  usesClassicCursorPagination,
} from './map-unipile-v2-search.util';
import {
  UNIPILE_V2_ACCOUNT_LIST_PAGE_SIZE,
  UNIPILE_V2_DEFAULT_BASE_URL,
  UNIPILE_V2_MAX_429_RETRIES,
} from './unipile-v2.constants';

export type UnipileV2RequestOptions = {
  returnStatus?: boolean;
  binary?: boolean;
};

const UNIPILE_WEBHOOK_EVENTS = [
  'account.add',
  'account.reconnect',
  'account.remove',
  'account.status.running',
  'account.status.disconnected',
  'account.status.errored',
  'message.new',
  'message.update',
  'message.delete',
  'message.receipt.read',
  'message.delivery',
  'message.reaction.new',
  'relation.new',
];

const toUserQuery = (
  query?: Record<string, string | undefined>,
): Record<string, string> => {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (key === 'account_id' || value == null || value === '') {
      continue;
    }
    next[key] = value;
  }
  if (next.linkedin_sections) {
    next.with_sections =
      next.linkedin_sections === '*'
        ? 'linkedin_*'
        : next.linkedin_sections.startsWith('linkedin_')
          ? next.linkedin_sections
          : `linkedin_${next.linkedin_sections}`;
    delete next.linkedin_sections;
  }
  return next;
};

const normalizeUnipileV2User = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const record = payload as Record<string, unknown>;
  const displayName =
    typeof record.display_name === 'string' ? record.display_name : undefined;
  return {
    ...record,
    name: record.name ?? displayName,
    first_name: record.first_name ?? displayName,
    public_identifier: record.public_identifier,
  };
};

const toV2MessageAttachments = (
  attachments?: Array<{
    filename: string;
    content_type: string;
    data?: string;
    content?: string;
    send_mode?: string;
  }>,
) =>
  (attachments ?? [])
    .map((attachment) => ({
      filename: attachment.filename,
      content_type: attachment.content_type,
      content: attachment.content || attachment.data || '',
      ...(attachment.send_mode ? { send_mode: attachment.send_mode } : {}),
    }))
    .filter((attachment) => attachment.content);

@Injectable()
export class UnipileV2Client {
  private readonly logger = new Logger(UnipileV2Client.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    @Optional() baseUrl?: string,
    @Optional() apiKey?: string,
  ) {
    this.baseUrl = (baseUrl || process.env.UNIPILE_API_URL || UNIPILE_V2_DEFAULT_BASE_URL)
      .replace(/\/$/, '');
    this.apiKey = apiKey || process.env.UNIPILE_ACCESS_TOKEN || '';
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  async request<T = unknown>(args: {
    path: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    binary?: boolean;
    returnStatus?: boolean;
  }): Promise<T> {
    const method = args.method ?? 'GET';
    const url = `${this.baseUrl}${args.path.startsWith('/') ? args.path : `/${args.path}`}`;
    const headers: Record<string, string> = {
      Accept: args.binary ? '*/*' : 'application/json',
      'X-API-KEY': this.apiKey,
    };
    if (args.body !== undefined && method !== 'GET' && !args.binary) {
      headers['Content-Type'] = 'application/json';
    }

    let attempt = 0;
    while (true) {
      const response = await fetch(url, {
        method,
        headers,
        body:
          args.body !== undefined && method !== 'GET'
            ? JSON.stringify(args.body)
            : undefined,
      });

      if (response.status === 429 && attempt < UNIPILE_V2_MAX_429_RETRIES) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '2');
        const waitMs = Number.isFinite(retryAfter)
          ? Math.max(retryAfter, 1) * 1000
          : 2000 * (attempt + 1);
        this.logger.warn(
          `Unipile 429 on ${method} ${args.path}; retrying in ${waitMs}ms`,
        );
        await this.sleep(waitMs);
        attempt += 1;
        continue;
      }

      if (args.binary) {
        if (!response.ok) {
          throw new HttpException(
            `Unipile API error: ${response.statusText}`,
            response.status,
          );
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        return buffer as T;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          (data as { detail?: string; message?: string }).detail ||
          (data as { message?: string }).message ||
          `Unipile API error: ${response.statusText}`;
        throw new HttpException(message, response.status);
      }

      if (args.returnStatus) {
        return { status: response.status, data } as T;
      }
      return data as T;
    }
  }

  async requestNormalized<T = unknown>(args: {
    path: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    binary?: boolean;
    returnStatus?: boolean;
  }): Promise<T> {
    const result = await this.request({
      path: args.path,
      method: args.method,
      body: args.body,
      binary: args.binary,
      returnStatus: args.returnStatus,
    });
    if (args.returnStatus) {
      const wrapped = result as { status: number; data: unknown };
      return {
        status: wrapped.status,
        data: this.normalizeAccountish(wrapped.data),
      } as T;
    }
    return this.normalizeAccountish(result) as T;
  }

  async listAccounts(): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let offset = 0;
    for (let page = 0; page < 50; page += 1) {
      const payload = await this.request({
        path: `/v2/accounts?offset=${offset}&limit=${UNIPILE_V2_ACCOUNT_LIST_PAGE_SIZE}`,
        method: 'GET',
      });
      const pageItems = extractUnipileListItems(payload).map(normalizeUnipileV2Account);
      items.push(...pageItems);
      if (pageItems.length < UNIPILE_V2_ACCOUNT_LIST_PAGE_SIZE) {
        break;
      }
      offset += UNIPILE_V2_ACCOUNT_LIST_PAGE_SIZE;
    }
    return items;
  }

  async getAccount(accountId: string): Promise<Record<string, unknown>> {
    const data = await this.request<Record<string, unknown>>({
      path: `/v2/accounts/${encodeURIComponent(accountId)}`,
      method: 'GET',
    });
    return normalizeUnipileV2Account(data);
  }

  async deleteAccount(accountId: string): Promise<void> {
    await this.request({
      path: `/v2/accounts/${encodeURIComponent(accountId)}`,
      method: 'DELETE',
    });
  }

  async startAuthIntent(
    body: Record<string, unknown>,
    options?: { returnStatus?: boolean },
  ): Promise<unknown> {
    return this.requestNormalized({
      path: '/v2/auth/intent',
      method: 'POST',
      body,
      returnStatus: options?.returnStatus,
    });
  }

  async solveCheckpoint(body: {
    intent_id: string;
    code?: string;
  }): Promise<unknown> {
    return this.requestNormalized({
      path: '/v2/auth/checkpoint',
      method: 'POST',
      body,
    });
  }

  async createHostedAuthLink(body: Record<string, unknown>): Promise<{
    link?: string;
    url?: string;
    hosted_link?: string;
  }> {
    const data = await this.request<{ link?: string; url?: string }>({
      path: '/v2/auth/link',
      method: 'POST',
      body,
    });
    const url = data.url ?? data.link;
    return { ...data, url, hosted_link: url };
  }

  async getUser(
    accountId: string,
    userId: string,
    query?: Record<string, string | undefined>,
  ): Promise<unknown> {
    const params = new URLSearchParams(toUserQuery(query));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const payload = await this.request({
      path: `/v2/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}${suffix}`,
      method: 'GET',
    });
    return normalizeUnipileV2User(payload);
  }

  async getUserPosts(
    accountId: string,
    userId: string,
    query?: Record<string, string | undefined>,
  ): Promise<unknown> {
    const params = new URLSearchParams(toUserQuery(query));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request({
      path: `/v2/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}/posts${suffix}`,
      method: 'GET',
    });
  }

  async getUserComments(
    accountId: string,
    userId: string,
    query?: Record<string, string | undefined>,
  ): Promise<unknown> {
    const params = new URLSearchParams(toUserQuery(query));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request({
      path: `/v2/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}/comments${suffix}`,
      method: 'GET',
    });
  }

  async getPost(
    accountId: string,
    postId: string,
    query?: Record<string, string | undefined>,
  ): Promise<unknown> {
    const params = new URLSearchParams(toUserQuery(query));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request({
      path: `/v2/${encodeURIComponent(accountId)}/posts/${encodeURIComponent(postId)}${suffix}`,
      method: 'GET',
    });
  }

  async getPostComments(
    accountId: string,
    postId: string,
    query?: Record<string, string | undefined>,
  ): Promise<unknown> {
    const params = new URLSearchParams(toUserQuery(query));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request({
      path: `/v2/${encodeURIComponent(accountId)}/posts/${encodeURIComponent(postId)}/comments${suffix}`,
      method: 'GET',
    });
  }

  async createPostComment(
    accountId: string,
    postId: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const next = { ...body };
    delete next.account_id;
    return this.request({
      path: `/v2/${encodeURIComponent(accountId)}/posts/${encodeURIComponent(postId)}/comments`,
      method: 'POST',
      body: next,
    });
  }

  async inviteUser(args: {
    accountId: string;
    userId: string;
    message?: string;
  }): Promise<unknown> {
    return this.request({
      path: `/v2/${encodeURIComponent(args.accountId)}/users/me/relation-requests`,
      method: 'POST',
      body: {
        user_id: args.userId,
        ...(args.message ? { message: args.message } : {}),
      },
    });
  }

  async getCompany(accountId: string, companyId: string): Promise<unknown> {
    return this.request({
      path: `/v2/${encodeURIComponent(accountId)}/linkedin/company/${encodeURIComponent(companyId)}`,
      method: 'GET',
    });
  }

  async searchLinkedIn(args: {
    accountId: string;
    api?: string;
    category?: string;
    body: Record<string, unknown>;
    cursor?: string;
    offset?: string | number;
    limit?: number;
  }): Promise<unknown> {
    const hasUrl = Boolean(args.body.url);
    const category = args.category ?? (hasUrl ? undefined : 'people');
    const nextBody = mapUnipileV2SearchBody(args.api, category, args.body);
    const classicCursor = usesClassicCursorPagination(args.api, category, hasUrl);
    const premium = isPremiumLinkedInSearchApi(args.api);
    const requestedLimit = premium
      ? Math.min(
          args.limit ?? UNIPILE_V2_PREMIUM_SEARCH_MAX_RESULTS,
          UNIPILE_V2_PREMIUM_SEARCH_MAX_RESULTS,
        )
      : Math.min(
          args.limit ?? UNIPILE_V2_CLASSIC_SEARCH_MAX_RESULTS,
          UNIPILE_V2_CLASSIC_SEARCH_MAX_RESULTS,
        );

    const fetchPage = (pageCursor?: string, pageOffset?: string | number) =>
      this.request({
        path: buildUnipileV2LinkedInSearchPath({
          accountId: args.accountId,
          api: args.api,
          category,
          hasUrl,
          cursor: classicCursor ? pageCursor : undefined,
          offset: premium ? pageOffset : undefined,
          limit: classicCursor ? undefined : requestedLimit,
        }),
        method: 'POST',
        body: nextBody,
      });

    if (!classicCursor) {
      return fetchPage(args.cursor, args.offset);
    }

    const items: Record<string, unknown>[] = [];
    let cursor = args.cursor;
    let lastPayload: unknown = { data: [] };
    for (let page = 0; page < 10 && items.length < requestedLimit; page += 1) {
      lastPayload = await fetchPage(cursor);
      const normalized = normalizeUnipileV2SearchItems(lastPayload, category);
      items.push(...normalized.items);
      if (!normalized.cursor || normalized.items.length === 0) {
        cursor = undefined;
        break;
      }
      cursor = normalized.cursor;
    }

    return {
      ...(typeof lastPayload === 'object' && lastPayload ? lastPayload : {}),
      data: items.slice(0, requestedLimit),
      items: items.slice(0, requestedLimit),
      next_cursor: cursor,
    };
  }

  async getLinkedInSearchParameters(args: {
    accountId: string;
    type: string;
    keywords?: string;
    limit?: number;
    api?: string;
  }): Promise<unknown> {
    const prefix =
      args.api === 'sales_navigator'
        ? 'sales-navigator/search/parameters'
        : args.api === 'recruiter'
          ? 'recruiter/search/parameters'
          : 'search/parameters';
    const query = new URLSearchParams({
      type: args.type === 'CONNECTIONS' ? 'RELATION' : args.type,
    });
    if (args.keywords) {
      query.set('keywords', args.keywords);
    }
    if (args.limit != null) {
      query.set('limit', String(args.limit));
    }
    return this.request({
      path: `/v2/${encodeURIComponent(args.accountId)}/linkedin/${prefix}?${query.toString()}`,
      method: 'GET',
    });
  }

  async linkedinRaw(
    accountId: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const nextBody = { ...body };
    if (typeof nextBody.request_url === 'string') {
      nextBody.url = nextBody.request_url;
      delete nextBody.request_url;
    }
    if ('encoding' in nextBody) {
      nextBody.bypass_url_encoding = nextBody.encoding;
      delete nextBody.encoding;
    }
    delete nextBody.account_id;
    delete nextBody.force_api;
    return this.request({
      path: `/v2/${encodeURIComponent(accountId)}/linkedin`,
      method: 'POST',
      body: nextBody,
    });
  }

  async listWebhookEndpoints(): Promise<unknown> {
    return this.request({
      path: '/v2/webhooks/endpoints',
      method: 'GET',
    });
  }

  async createWebhookEndpoint(body: Record<string, unknown>): Promise<unknown> {
    return this.request({
      path: '/v2/webhooks/endpoints',
      method: 'POST',
      body: {
        url: body.url ?? body.request_url,
        events: body.events ?? UNIPILE_WEBHOOK_EVENTS,
        headers: body.headers,
      },
    });
  }

  async deleteWebhookEndpoint(webhookId: string): Promise<unknown> {
    return this.request({
      path: `/v2/webhooks/endpoints/${encodeURIComponent(webhookId)}`,
      method: 'DELETE',
    });
  }

  async sendChat(args: {
    accountId: string;
    usersIds: string[];
    text: string;
    attachments?: Array<{
      filename: string;
      content_type: string;
      data?: string;
      content?: string;
    }>;
    name?: string;
    specifics?: Record<string, unknown>;
  }): Promise<unknown> {
    const attachments = toV2MessageAttachments(args.attachments);
    return this.request({
      path: `/v2/${encodeURIComponent(args.accountId)}/chats/send`,
      method: 'POST',
      body: {
        users_ids: args.usersIds,
        text: args.text,
        ...(attachments.length ? { attachments } : {}),
        ...(args.name ? { name: args.name } : {}),
        ...(args.specifics ? { specifics: args.specifics } : {}),
      },
    });
  }

  async startChatFromInbox(args: {
    accountId: string;
    inboxId: string;
    usersIds: string[];
    text: string;
    attachments?: Array<{
      filename: string;
      content_type: string;
      data?: string;
      content?: string;
    }>;
    name?: string;
    options?: Record<string, unknown>;
  }): Promise<unknown> {
    const attachments = toV2MessageAttachments(args.attachments);
    return this.request({
      path: `/v2/${encodeURIComponent(args.accountId)}/inboxes/${encodeURIComponent(args.inboxId)}/chats`,
      method: 'POST',
      body: {
        users_ids: args.usersIds,
        text: args.text,
        ...(attachments.length ? { attachments } : {}),
        ...(args.name ? { name: args.name } : {}),
        ...(args.options ? { options: args.options } : {}),
      },
    });
  }

  async sendChatMessage(args: {
    accountId: string;
    chatId: string;
    text: string;
    attachments?: Array<{
      filename: string;
      content_type: string;
      data?: string;
      content?: string;
    }>;
    quoteId?: string;
  }): Promise<unknown> {
    const attachments = toV2MessageAttachments(args.attachments);
    return this.request({
      path: `/v2/${encodeURIComponent(args.accountId)}/chats/${encodeURIComponent(args.chatId)}/messages/send`,
      method: 'POST',
      body: {
        text: args.text,
        ...(attachments.length ? { attachments } : {}),
        ...(args.quoteId ? { quote_id: args.quoteId } : {}),
      },
    });
  }

  async getUserChat(accountId: string, userId: string): Promise<unknown> {
    return this.request({
      path: `/v2/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}/chats`,
      method: 'GET',
    });
  }

  async listChatMessages(args: {
    accountId: string;
    chatId: string;
    userId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<unknown> {
    const query = new URLSearchParams();
    if (args.userId) {
      query.set('user_id', args.userId);
    }
    if (args.cursor) {
      query.set('cursor', args.cursor);
    }
    if (args.limit != null) {
      query.set('limit', String(args.limit));
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request({
      path: `/v2/${encodeURIComponent(args.accountId)}/chats/${encodeURIComponent(args.chatId)}/messages${suffix}`,
      method: 'GET',
    });
  }

  async downloadAttachment(args: {
    accountId: string;
    chatId: string;
    messageId: string;
    attachmentId: string;
  }): Promise<Buffer> {
    return this.request<Buffer>({
      path: `/v2/${encodeURIComponent(args.accountId)}/chats/${encodeURIComponent(args.chatId)}/messages/${encodeURIComponent(args.messageId)}/attachments/${encodeURIComponent(args.attachmentId)}`,
      method: 'GET',
      binary: true,
    });
  }

  private normalizeAccountish(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }
    const record = data as Record<string, unknown>;
    if (typeof record.id === 'string' && (record.provider || record.status)) {
      return normalizeUnipileV2Account(record);
    }
    const items = extractUnipileListItems(record);
    if (items.length > 0 && (record.items || record.data)) {
      return {
        ...record,
        items: items.map(normalizeUnipileV2Account),
        cursor: extractUnipileNextCursor(record),
      };
    }
    if (typeof record.link === 'string' && !record.url) {
      return { ...record, url: record.link };
    }
    if (record.object === 'AuthenticationCheckpoint' || record.object === 'Checkpoint') {
      return {
        ...record,
        account_id: record.intent_id ?? record.account_id,
        object: 'Checkpoint',
      };
    }
    if (record.object === 'AuthenticationQrCode') {
      return {
        ...record,
        qrCodeString: record.qrcode ?? record.qrCodeString,
        account_id: record.intent_id ?? record.account_id,
      };
    }
    if (record.object === 'Account') {
      return normalizeUnipileV2Account(record);
    }
    return data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
