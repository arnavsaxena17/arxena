export type UnipileNormalizedAccount = Record<string, unknown> & {
  id?: string;
  name?: string;
  type?: string;
  provider?: string;
  status?: string;
  phone_number?: string;
  created_at?: string;
  connection_params?: {
    im?: { phone_number?: string; status?: string; publicIdentifier?: string };
    status?: string;
  };
  sources?: { status?: string }[];
  metadata?: Record<string, unknown>;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export const mapUnipileV2StatusToLegacy = (
  status: string | undefined,
): string => {
  const normalized = status?.trim().toLowerCase() ?? '';
  if (['running', 'ok', 'connected', 'active', 'ready', 'synced'].includes(normalized)) {
    return 'running';
  }
  if (['disconnected', 'credentials'].includes(normalized)) {
    return 'disconnected';
  }
  if (['errored', 'error', 'stopped', 'failed'].includes(normalized)) {
    return 'errored';
  }
  if (['partial', 'degraded', 'connecting', 'pending', 'syncing'].includes(normalized)) {
    return 'connecting';
  }
  return status ?? '';
};

export const normalizeUnipileV2Account = (
  raw: Record<string, unknown>,
): UnipileNormalizedAccount => {
  const provider = String(raw.provider ?? raw.type ?? '')
    .trim()
    .toLowerCase();
  const type = provider ? provider.toUpperCase() : undefined;
  const status = mapUnipileV2StatusToLegacy(
    typeof raw.status === 'string' ? raw.status : undefined,
  );
  const metadata = asRecord(raw.metadata);
  const name = typeof raw.name === 'string' ? raw.name : undefined;
  const phoneNumber =
    provider === 'whatsapp' && name ? name : undefined;

  return {
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : undefined,
    name,
    provider: type,
    type,
    status,
    phone_number: phoneNumber,
    created_at:
      typeof raw.created_at === 'string' ? raw.created_at : undefined,
    metadata,
    connection_params: {
      status,
      im: {
        status,
        phone_number: phoneNumber,
      },
    },
    sources: [{ status }],
  };
};

export const extractUnipileListItems = (
  payload: unknown,
): Record<string, unknown>[] => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.items)) {
    return record.items.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object' && !Array.isArray(item),
    );
  }
  if (Array.isArray(record.data)) {
    return record.data.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object' && !Array.isArray(item),
    );
  }
  return [];
};

export const extractUnipileNextCursor = (
  payload: unknown,
): string | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  const cursor =
    record.next_cursor ?? record.cursor ?? asRecord(record.paging)?.cursor;
  return typeof cursor === 'string' && cursor.trim() ? cursor.trim() : undefined;
};
