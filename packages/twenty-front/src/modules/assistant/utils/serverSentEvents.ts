export type ParsedServerSentEvent = {
  eventType: string;
  dataStr: string;
};

export const parseServerSentEvent = (raw: string): ParsedServerSentEvent | null => {
  let eventType = 'message';
  let dataStr = '';

  for (const line of raw.split('\n')) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    }
    if (line.startsWith('data: ')) {
      dataStr = line.slice(6);
    }
  }

  return dataStr ? { eventType, dataStr } : null;
};

