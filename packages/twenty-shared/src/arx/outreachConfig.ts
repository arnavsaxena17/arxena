export type OutreachProjectIcpSpec = {
  targetTitles: string[];
  locations: string[];
};

export type OutreachConfigExperiment = {
  status: 'running' | 'paused' | 'completed';
  split: number;
  name?: string;
  workflows?: Record<string, unknown>;
};

export type OutreachConfig = {
  v: 1;
  maxPersonasPerCompany?: number | null;
  inMailFallbackEnabled?: boolean | null;
  sendTimezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  sendWindowDays?: string | null;
  icpSpec?: OutreachProjectIcpSpec | null;
  experimentConfig?: OutreachConfigExperiment | null;
  updatedAt?: string | null;
};

export const DEFAULT_OUTREACH_CONFIG_VALUES: Omit<OutreachConfig, 'v'> = {
  maxPersonasPerCompany: 2,
  inMailFallbackEnabled: false,
  sendTimezone: 'Asia/Kolkata',
  sendWindowStart: '08:00',
  sendWindowEnd: '10:00',
  sendWindowDays: '2,3,4',
  icpSpec: null,
  experimentConfig: null,
};

const readString = (
  record: Record<string, unknown>,
  key: keyof OutreachConfig,
): string | null => {
  const fieldValue = record[key as string];

  return typeof fieldValue === 'string' && fieldValue.length > 0
    ? fieldValue
    : null;
};

const readNumber = (
  record: Record<string, unknown>,
  key: keyof OutreachConfig,
): number | null => {
  const fieldValue = record[key as string];

  return typeof fieldValue === 'number' && Number.isFinite(fieldValue)
    ? fieldValue
    : null;
};

const readBoolean = (
  record: Record<string, unknown>,
  key: keyof OutreachConfig,
): boolean | null => {
  const fieldValue = record[key as string];

  return typeof fieldValue === 'boolean' ? fieldValue : null;
};

const parseIcpSpecObject = (value: unknown): OutreachProjectIcpSpec | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      try {
        return parseIcpSpecObject(JSON.parse(value));
      } catch {
        return null;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;
  const toStringList = (items: unknown): string[] =>
    Array.isArray(items)
      ? items.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        )
      : [];

  const targetTitles = [
    ...toStringList(record.targetTitles),
    ...toStringList(record.buyerTitles),
  ];
  const locations = [
    ...toStringList(record.locations),
    ...toStringList(record.geos),
  ];

  return {
    targetTitles: [...new Set(targetTitles)],
    locations: [...new Set(locations)],
  };
};

const parseExperimentConfigObject = (
  value: unknown,
): OutreachConfigExperiment | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      return parseExperimentConfigObject(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const status = record.status;

  if (
    status !== 'running' &&
    status !== 'paused' &&
    status !== 'completed'
  ) {
    return null;
  }

  const splitRaw = record.split;
  const split =
    typeof splitRaw === 'number' && Number.isFinite(splitRaw)
      ? Math.min(1, Math.max(0, splitRaw))
      : 0.5;

  return {
    status,
    split,
    ...(typeof record.name === 'string' ? { name: record.name } : {}),
    ...(typeof record.workflows === 'object' && record.workflows !== null
      ? { workflows: record.workflows as Record<string, unknown> }
      : {}),
  };
};

export const parseOutreachConfig = (
  value: unknown,
): OutreachConfig | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    v: 1,
    maxPersonasPerCompany: readNumber(record, 'maxPersonasPerCompany'),
    inMailFallbackEnabled: readBoolean(record, 'inMailFallbackEnabled'),
    sendTimezone: readString(record, 'sendTimezone'),
    sendWindowStart: readString(record, 'sendWindowStart'),
    sendWindowEnd: readString(record, 'sendWindowEnd'),
    sendWindowDays: readString(record, 'sendWindowDays'),
    icpSpec: parseIcpSpecObject(record.icpSpec),
    experimentConfig: parseExperimentConfigObject(record.experimentConfig),
    updatedAt: readString(record, 'updatedAt'),
  };
};

export const stringifyOutreachProjectIcpSpec = (
  icpSpec: OutreachProjectIcpSpec,
): string => JSON.stringify(icpSpec);

export const resolveOutreachConfigMaxPersonasPerCompany = (
  config: unknown,
  flatFallback?: number | null,
): number =>
  parseOutreachConfig(config)?.maxPersonasPerCompany ??
  flatFallback ??
  DEFAULT_OUTREACH_CONFIG_VALUES.maxPersonasPerCompany ??
  2;

export const resolveOutreachConfigInMailFallbackEnabled = (
  config: unknown,
  flatFallback?: boolean | null,
): boolean =>
  parseOutreachConfig(config)?.inMailFallbackEnabled ??
  flatFallback ??
  DEFAULT_OUTREACH_CONFIG_VALUES.inMailFallbackEnabled ??
  false;

export const resolveOutreachConfigSendTimezone = (
  config: unknown,
  flatFallback?: string | null,
): string =>
  parseOutreachConfig(config)?.sendTimezone ??
  flatFallback ??
  DEFAULT_OUTREACH_CONFIG_VALUES.sendTimezone ??
  'Asia/Kolkata';

export const resolveOutreachConfigSendWindowStart = (
  config: unknown,
  flatFallback?: string | null,
): string =>
  parseOutreachConfig(config)?.sendWindowStart ??
  flatFallback ??
  DEFAULT_OUTREACH_CONFIG_VALUES.sendWindowStart ??
  '08:00';

export const resolveOutreachConfigSendWindowEnd = (
  config: unknown,
  flatFallback?: string | null,
): string =>
  parseOutreachConfig(config)?.sendWindowEnd ??
  flatFallback ??
  DEFAULT_OUTREACH_CONFIG_VALUES.sendWindowEnd ??
  '10:00';

export const resolveOutreachConfigSendWindowDays = (
  config: unknown,
  flatFallback?: string | null,
): string =>
  parseOutreachConfig(config)?.sendWindowDays ??
  flatFallback ??
  DEFAULT_OUTREACH_CONFIG_VALUES.sendWindowDays ??
  '2,3,4';

export const resolveOutreachConfigIcpSpecString = (
  config: unknown,
  flatFallback?: string | null,
): string | null => {
  const parsedIcpSpec = parseOutreachConfig(config)?.icpSpec;

  if (parsedIcpSpec) {
    return stringifyOutreachProjectIcpSpec(parsedIcpSpec);
  }

  return flatFallback ?? null;
};

export const resolveOutreachConfigExperimentConfigString = (
  config: unknown,
  flatFallback?: string | null,
): string | null => {
  const experimentConfig = parseOutreachConfig(config)?.experimentConfig;

  if (experimentConfig) {
    return JSON.stringify(experimentConfig);
  }

  return flatFallback ?? null;
};

export const mergeLegacyProjectFieldsIntoConfig = ({
  existingConfig,
  maxPersonasPerCompany,
  inMailFallbackEnabled,
  sendTimezone,
  sendWindowStart,
  sendWindowEnd,
  sendWindowDays,
  icpSpec,
  experimentConfig,
}: {
  existingConfig?: unknown;
  maxPersonasPerCompany?: number | null;
  inMailFallbackEnabled?: boolean | null;
  sendTimezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  sendWindowDays?: string | null;
  icpSpec?: string | null;
  experimentConfig?: string | null;
}): OutreachConfig => {
  const parsedExisting = parseOutreachConfig(existingConfig);

  return {
    v: 1,
    maxPersonasPerCompany:
      parsedExisting?.maxPersonasPerCompany ??
      maxPersonasPerCompany ??
      DEFAULT_OUTREACH_CONFIG_VALUES.maxPersonasPerCompany,
    inMailFallbackEnabled:
      parsedExisting?.inMailFallbackEnabled ??
      inMailFallbackEnabled ??
      DEFAULT_OUTREACH_CONFIG_VALUES.inMailFallbackEnabled,
    sendTimezone:
      parsedExisting?.sendTimezone ??
      sendTimezone ??
      DEFAULT_OUTREACH_CONFIG_VALUES.sendTimezone,
    sendWindowStart:
      parsedExisting?.sendWindowStart ??
      sendWindowStart ??
      DEFAULT_OUTREACH_CONFIG_VALUES.sendWindowStart,
    sendWindowEnd:
      parsedExisting?.sendWindowEnd ??
      sendWindowEnd ??
      DEFAULT_OUTREACH_CONFIG_VALUES.sendWindowEnd,
    sendWindowDays:
      parsedExisting?.sendWindowDays ??
      sendWindowDays ??
      DEFAULT_OUTREACH_CONFIG_VALUES.sendWindowDays,
    icpSpec:
      parsedExisting?.icpSpec ??
      parseIcpSpecObject(icpSpec) ??
      DEFAULT_OUTREACH_CONFIG_VALUES.icpSpec,
    experimentConfig:
      parsedExisting?.experimentConfig ??
      parseExperimentConfigObject(experimentConfig) ??
      DEFAULT_OUTREACH_CONFIG_VALUES.experimentConfig,
    updatedAt: new Date().toISOString(),
  };
};

export const applyOutreachConfigPatch = ({
  existing,
  patch,
  nowIso = new Date().toISOString(),
}: {
  existing: OutreachConfig | null | undefined;
  patch: Partial<Omit<OutreachConfig, 'v'>>;
  nowIso?: string;
}): OutreachConfig => {
  const base = {
    ...DEFAULT_OUTREACH_CONFIG_VALUES,
    ...existing,
    ...patch,
    updatedAt: nowIso,
  };

  return {
    v: 1,
    maxPersonasPerCompany: base.maxPersonasPerCompany ?? 2,
    inMailFallbackEnabled: base.inMailFallbackEnabled ?? false,
    sendTimezone: base.sendTimezone ?? 'Asia/Kolkata',
    sendWindowStart: base.sendWindowStart ?? '08:00',
    sendWindowEnd: base.sendWindowEnd ?? '10:00',
    sendWindowDays: base.sendWindowDays ?? '2,3,4',
    icpSpec: base.icpSpec ?? null,
    experimentConfig: base.experimentConfig ?? null,
    updatedAt: base.updatedAt ?? nowIso,
  };
};

export const buildProjectConfigUpdate = ({
  existingConfig,
  patch,
  nowIso = new Date().toISOString(),
}: {
  existingConfig: unknown;
  patch: Partial<Omit<OutreachConfig, 'v'>>;
  nowIso?: string;
}): { outreachConfig: OutreachConfig } => ({
  outreachConfig: applyOutreachConfigPatch({
    existing: parseOutreachConfig(existingConfig),
    patch,
    nowIso,
  }),
});

export const buildDefaultOutreachConfig = (): OutreachConfig => ({
  v: 1,
  ...DEFAULT_OUTREACH_CONFIG_VALUES,
  updatedAt: new Date().toISOString(),
});
