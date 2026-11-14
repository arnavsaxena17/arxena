export const UNIPILE_RELATIONS_DEFAULT_LIMIT = 25;
export const UNIPILE_RELATIONS_MIN_LIMIT = 1;
export const UNIPILE_RELATIONS_MAX_LIMIT = 1000;

export type UnipileUserRelation = {
  object?: 'UserRelation' | string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  public_identifier?: string;
  public_profile_url?: string;
  created_at?: number;
  member_id?: string;
  member_urn?: string;
  connection_urn?: string;
  profile_picture_url?: string;
  [key: string]: unknown;
};

export type UnipileUserRelationsList = {
  object: 'UserRelationsList';
  items: UnipileUserRelation[];
  cursor: string | null;
};

export const clampUnipileRelationsLimit = (
  limit?: number | string,
): number => {
  const parsed =
    typeof limit === 'string' ? Number.parseInt(limit, 10) : limit;

  if (parsed == null || !Number.isFinite(parsed)) {
    return UNIPILE_RELATIONS_DEFAULT_LIMIT;
  }

  return Math.min(
    UNIPILE_RELATIONS_MAX_LIMIT,
    Math.max(UNIPILE_RELATIONS_MIN_LIMIT, Math.trunc(parsed)),
  );
};

export const sortUnipileRelationsByRecentlyAdded = (
  items: UnipileUserRelation[],
): UnipileUserRelation[] =>
  [...items].sort(
    (left, right) =>
      (Number(right.created_at) || 0) - (Number(left.created_at) || 0),
  );

export const normalizeUnipileUserRelationsList = (
  data: unknown,
  limit: number = UNIPILE_RELATIONS_DEFAULT_LIMIT,
): UnipileUserRelationsList => {
  const record =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = sortUnipileRelationsByRecentlyAdded(
    rawItems.filter(
      (item): item is UnipileUserRelation =>
        Boolean(item) && typeof item === 'object',
    ),
  ).slice(0, clampUnipileRelationsLimit(limit));
  const cursor =
    typeof record.cursor === 'string' && record.cursor.trim().length > 0
      ? record.cursor
      : null;

  return {
    object: 'UserRelationsList',
    items,
    cursor,
  };
};
