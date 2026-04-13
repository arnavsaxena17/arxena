/**
 * Incremental SSE parser (NestJS writes `event: name\ndata: {...}\n\n`).
 */
export type SseEventRecord = { event: string; data: Record<string, unknown> };

export function parseSseChunks(
  buffer: string,
): { events: SseEventRecord[]; remainder: string } {
  const events: SseEventRecord[] = [];
  let rest = buffer;
  const blocks = rest.split('\n\n');

  if (!rest.endsWith('\n\n')) {
    rest = blocks.pop() ?? '';
  } else {
    rest = '';
  }

  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }
    const dataStr = dataLines.join('\n');
    if (dataStr.length === 0) continue;
    try {
      const data = JSON.parse(dataStr) as Record<string, unknown>;
      events.push({ event: eventName, data });
    } catch {
      events.push({ event: eventName, data: { raw: dataStr } });
    }
  }

  return { events, remainder: rest };
}

/**
 * Consume a fetch Response body as SSE and collect all parsed events.
 */
export async function collectSseFromResponse(
  res: Response,
): Promise<SseEventRecord[]> {
  const reader = res.body?.getReader();
  if (!reader) return [];
  const decoder = new TextDecoder();
  let buf = '';
  const all: SseEventRecord[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const { events, remainder } = parseSseChunks(buf);
    all.push(...events);
    buf = remainder;
  }
  const { events: tail } = parseSseChunks(buf + '\n\n');
  all.push(...tail);
  return all;
}

/**
 * Same as collectSseFromResponse but invokes `onBatch` after each parsed chunk so callers can
 * react mid-stream (e.g. subscribe to Redis when `alternate_candidate_source_queued` appears).
 */
export async function collectSseFromResponseWithHook(
  res: Response,
  onBatch: (
    batch: SseEventRecord[],
    accumulated: SseEventRecord[],
  ) => void | Promise<void>,
): Promise<SseEventRecord[]> {
  const reader = res.body?.getReader();
  if (!reader) return [];
  const decoder = new TextDecoder();
  let buf = '';
  const all: SseEventRecord[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const { events, remainder } = parseSseChunks(buf);
    if (events.length > 0) {
      all.push(...events);
      await onBatch(events, all);
    }
    buf = remainder;
  }
  const { events: tail } = parseSseChunks(buf + '\n\n');
  if (tail.length > 0) {
    all.push(...tail);
    await onBatch(tail, all);
  }
  return all;
}
