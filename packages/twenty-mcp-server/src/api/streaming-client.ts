const TIMEOUT_MS = 300_000; // 5 minutes for streaming operations

export type StreamingEventType =
  | 'text'
  | 'table_data'
  | 'org_chart'
  | 'done'
  | 'error'
  | 'status'
  | 'classification'
  | 'message'
  | 'clarification'
  | 'paginationInfo'
  | 'pageResults'
  | 'candidateBatch'
  | 'validation'
  | 'tokenUsage';

export type StreamingEvent = {
  type: StreamingEventType;
  data: Record<string, unknown>;
};

export type StreamingResult = {
  text: string;
  tableDataList?: Array<{ columns: string[]; rows: Record<string, unknown>[] }>;
  orgCharts?: Array<{
    companyId: string;
    companyName: string;
    slug: string;
    viewUrl: string;
    country?: string;
    functionRoot?: string;
  }>;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  events: StreamingEvent[];
  error?: string;
};

/**
 * Handle Server-Sent Events (SSE) streaming responses from backend endpoints.
 * Accumulates events and returns final result when stream completes.
 */
export async function handleStreamingResponse(
  baseUrl: string,
  apiToken: string,
  pathPrefix: string,
  endpoint: string,
  body: Record<string, unknown> = {},
): Promise<StreamingResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  console.log('handleStreamingResponse', baseUrl, apiToken, pathPrefix, endpoint, body);
  try {
    const url = `${baseUrl}/${pathPrefix}/${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Streaming API call to /${pathPrefix}/${endpoint} failed: ${response.status} ${text}`,
      );
    }

    // Check if response is streaming (SSE)
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/event-stream')) {
      // Not streaming, return as JSON
      return {
        text: '',
        events: [],
        ...(await response.json()),
      };
    }

    // Handle SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) {
      throw new Error('Stream reader not available');
    }

    const result: StreamingResult = {
      text: '',
      events: [],
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const raw of events) {
        if (!raw.trim()) continue;

        let eventType: StreamingEventType = 'status';
        let dataStr = '';

        for (const line of raw.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim() as StreamingEventType;
          }
          if (line.startsWith('data: ')) {
            dataStr = line.slice(6);
          }
        }

        if (!dataStr) continue;

        try {
          const data = JSON.parse(dataStr) as Record<string, unknown>;

          const event: StreamingEvent = {
            type: eventType,
            data,
          };
          result.events.push(event);

          // Accumulate text deltas
          if (eventType === 'text' && typeof data.delta === 'string') {
            result.text += data.delta;
          }

          // Handle table data
          if (eventType === 'table_data') {
            const columns = Array.isArray(data.columns) ? (data.columns as string[]) : [];
            const rows = Array.isArray(data.rows) ? data.rows : [];
            if (columns.length > 0 && rows.length > 0) {
              if (!result.tableDataList) {
                result.tableDataList = [];
              }
              result.tableDataList.push({
                columns,
                rows: rows as Record<string, unknown>[],
              });
            }
          }

          // Handle org chart
          if (eventType === 'org_chart') {
            const orgChartData = data.orgChart as {
              companyId?: string;
              companyName?: string;
              slug?: string;
              viewUrl?: string;
              country?: string;
              functionRoot?: string;
            } | undefined;
            if (orgChartData?.companyId && orgChartData?.viewUrl) {
              if (!result.orgCharts) {
                result.orgCharts = [];
              }
              result.orgCharts.push({
                companyId: orgChartData.companyId,
                companyName: orgChartData.companyName || orgChartData.companyId,
                slug: orgChartData.slug || orgChartData.companyId,
                viewUrl: orgChartData.viewUrl,
                country: orgChartData.country,
                functionRoot: orgChartData.functionRoot,
              });
            }
          }

          // Handle done event
          if (eventType === 'done') {
            if (typeof data.text === 'string' && data.text) {
              result.text = data.text;
            }
            if (Array.isArray(data.toolCalls)) {
              result.toolCalls = data.toolCalls as Array<{
                name: string;
                args: Record<string, unknown>;
              }>;
            }
          }

          // Handle error event
          if (eventType === 'error' && typeof data.error === 'string') {
            result.error = data.error;
          }
        } catch (parseError) {
          // Ignore malformed JSON in stream
          console.warn('Failed to parse SSE event data:', parseError);
        }
      }
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}
